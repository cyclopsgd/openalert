import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { eq, and, sql, inArray, or } from 'drizzle-orm';
import { services, serviceDependencies, incidents, teams } from '../../database/schema';

@Injectable()
export class ServicesService {
  constructor(private readonly db: DatabaseService) {}

  async create(createServiceDto: CreateServiceDto) {
    const { dependencyIds, slug, ...serviceData } = createServiceDto;

    // Generate slug from name if not provided
    const serviceSlug = slug || this.generateSlug(createServiceDto.name);

    // Check if slug already exists
    const existing = await this.db
      .select()
      .from(services)
      .where(eq(services.slug, serviceSlug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Service with slug "${serviceSlug}" already exists`);
    }

    // Verify team exists
    const team = await this.db.select().from(teams).where(eq(teams.id, serviceData.teamId)).limit(1);
    if (team.length === 0) {
      throw new NotFoundException(`Team with ID ${serviceData.teamId} not found`);
    }

    // Create service
    const [service] = await this.db
      .insert(services)
      .values({
        ...serviceData,
        slug: serviceSlug,
      })
      .returning();

    // Add dependencies if provided
    if (dependencyIds && dependencyIds.length > 0) {
      await this.addDependencies(service.id, dependencyIds);
    }

    return this.findOne(service.id);
  }

  async findAll(teamId?: number) {
    const query = this.db.select().from(services);

    if (teamId) {
      query.where(eq(services.teamId, teamId));
    }

    const allServices = await query;

    // Get active incident counts for each service
    const serviceIds = allServices.map((s) => s.id);

    if (serviceIds.length === 0) {
      return [];
    }

    const incidentCounts = await this.db
      .select({
        serviceId: incidents.serviceId,
        count: sql<number>`count(*)::int`,
      })
      .from(incidents)
      .where(
        and(
          inArray(incidents.serviceId, serviceIds),
          or(eq(incidents.status, 'triggered'), eq(incidents.status, 'acknowledged')),
        ),
      )
      .groupBy(incidents.serviceId);

    const incidentCountMap = new Map(incidentCounts.map((ic) => [ic.serviceId, ic.count]));

    // Get dependency counts
    const dependencyCounts = await this.db
      .select({
        serviceId: serviceDependencies.serviceId,
        count: sql<number>`count(*)::int`,
      })
      .from(serviceDependencies)
      .where(inArray(serviceDependencies.serviceId, serviceIds))
      .groupBy(serviceDependencies.serviceId);

    const dependencyCountMap = new Map(dependencyCounts.map((dc) => [dc.serviceId, dc.count]));

    // Combine results
    return allServices.map((service) => ({
      ...service,
      activeIncidentCount: incidentCountMap.get(service.id) || 0,
      dependencyCount: dependencyCountMap.get(service.id) || 0,
    }));
  }

  async findOne(id: number) {
    const [service] = await this.db.select().from(services).where(eq(services.id, id)).limit(1);

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    // Get dependencies (services this service depends on)
    const dependencies = await this.db
      .select({
        id: serviceDependencies.id,
        serviceId: serviceDependencies.serviceId,
        dependsOnServiceId: serviceDependencies.dependsOnServiceId,
        dependsOnService: services,
      })
      .from(serviceDependencies)
      .innerJoin(services, eq(serviceDependencies.dependsOnServiceId, services.id))
      .where(eq(serviceDependencies.serviceId, id));

    // Get dependents (services that depend on this service)
    const dependents = await this.db
      .select({
        id: serviceDependencies.id,
        serviceId: serviceDependencies.serviceId,
        dependsOnServiceId: serviceDependencies.dependsOnServiceId,
        dependentService: services,
      })
      .from(serviceDependencies)
      .innerJoin(services, eq(serviceDependencies.serviceId, services.id))
      .where(eq(serviceDependencies.dependsOnServiceId, id));

    // Get active incidents
    const activeIncidents = await this.db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.serviceId, id),
          or(eq(incidents.status, 'triggered'), eq(incidents.status, 'acknowledged')),
        ),
      )
      .orderBy(incidents.triggeredAt);

    return {
      ...service,
      dependencies: dependencies.map((d) => ({
        id: d.id,
        service: d.dependsOnService,
      })),
      dependents: dependents.map((d) => ({
        id: d.id,
        service: d.dependentService,
      })),
      activeIncidents,
    };
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {
    const { dependencyIds, ...updateData } = updateServiceDto;

    // Verify service exists
    const existing = await this.findOne(id);

    // If slug is being updated, check for conflicts
    if (updateData.slug && updateData.slug !== existing.slug) {
      const conflict = await this.db
        .select()
        .from(services)
        .where(eq(services.slug, updateData.slug))
        .limit(1);

      if (conflict.length > 0) {
        throw new ConflictException(`Service with slug "${updateData.slug}" already exists`);
      }
    }

    // Update service
    if (Object.keys(updateData).length > 0) {
      await this.db
        .update(services)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(services.id, id));
    }

    // Update dependencies if provided
    if (dependencyIds !== undefined) {
      // Remove all existing dependencies
      await this.db.delete(serviceDependencies).where(eq(serviceDependencies.serviceId, id));

      // Add new dependencies
      if (dependencyIds.length > 0) {
        await this.addDependencies(id, dependencyIds);
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const service = await this.findOne(id);

    await this.db.delete(services).where(eq(services.id, id));

    return { deleted: true, service };
  }

  async addDependency(serviceId: number, dependsOnServiceId: number) {
    // Verify both services exist
    await this.findOne(serviceId);
    await this.findOne(dependsOnServiceId);

    // Prevent self-dependency
    if (serviceId === dependsOnServiceId) {
      throw new BadRequestException('A service cannot depend on itself');
    }

    // Check if dependency already exists
    const existing = await this.db
      .select()
      .from(serviceDependencies)
      .where(
        and(
          eq(serviceDependencies.serviceId, serviceId),
          eq(serviceDependencies.dependsOnServiceId, dependsOnServiceId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('This dependency already exists');
    }

    // Check for circular dependencies
    const wouldCreateCircle = await this.wouldCreateCircularDependency(serviceId, dependsOnServiceId);
    if (wouldCreateCircle) {
      throw new BadRequestException('This dependency would create a circular reference');
    }

    // Add dependency
    const [dependency] = await this.db
      .insert(serviceDependencies)
      .values({
        serviceId,
        dependsOnServiceId,
      })
      .returning();

    return dependency;
  }

  async removeDependency(serviceId: number, dependencyId: number) {
    const [dependency] = await this.db
      .select()
      .from(serviceDependencies)
      .where(
        and(
          eq(serviceDependencies.serviceId, serviceId),
          eq(serviceDependencies.id, dependencyId),
        ),
      )
      .limit(1);

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.db.delete(serviceDependencies).where(eq(serviceDependencies.id, dependencyId));

    return { deleted: true, dependency };
  }

  async getHealth(id: number) {
    const service = await this.findOne(id);

    // Calculate health based on active incidents and dependency health
    const activeIncidentCount = service.activeIncidents.length;
    const criticalIncidents = service.activeIncidents.filter((i) => i.severity === 'critical').length;
    const highIncidents = service.activeIncidents.filter((i) => i.severity === 'high').length;

    // Check dependency health
    let dependencyIssues = 0;
    for (const dep of service.dependencies) {
      if (dep.service.status !== 'operational') {
        dependencyIssues++;
      }
    }

    // Determine overall health
    let health = 'healthy';
    let score = 100;

    if (service.status === 'outage' || criticalIncidents > 0) {
      health = 'critical';
      score = 0;
    } else if (service.status === 'degraded' || highIncidents > 0 || dependencyIssues > 0) {
      health = 'degraded';
      score = 50;
    } else if (service.status === 'maintenance') {
      health = 'maintenance';
      score = 75;
    } else if (activeIncidentCount > 0) {
      health = 'warning';
      score = 85;
    }

    return {
      service: {
        id: service.id,
        name: service.name,
        status: service.status,
      },
      health,
      score,
      metrics: {
        activeIncidents: activeIncidentCount,
        criticalIncidents,
        highIncidents,
        dependencyIssues,
      },
      dependencies: service.dependencies.map((d) => ({
        id: d.service.id,
        name: d.service.name,
        status: d.service.status,
      })),
    };
  }

  async getDependencyGraph(id: number) {
    await this.findOne(id); // Verify service exists

    const graph = await this.buildDependencyGraph(id);

    return {
      serviceId: id,
      graph,
    };
  }

  private async buildDependencyGraph(serviceId: number, visited: Set<number> = new Set()): Promise<any> {
    if (visited.has(serviceId)) {
      return { circular: true };
    }

    visited.add(serviceId);

    const [service] = await this.db.select().from(services).where(eq(services.id, serviceId)).limit(1);

    if (!service) {
      return null;
    }

    const dependencies = await this.db
      .select({
        id: serviceDependencies.id,
        serviceId: serviceDependencies.serviceId,
        dependsOnServiceId: serviceDependencies.dependsOnServiceId,
      })
      .from(serviceDependencies)
      .where(eq(serviceDependencies.serviceId, serviceId));

    const dependencyNodes = await Promise.all(
      dependencies.map((dep) => this.buildDependencyGraph(dep.dependsOnServiceId, new Set(visited))),
    );

    return {
      id: service.id,
      name: service.name,
      status: service.status,
      dependencies: dependencyNodes.filter((n) => n !== null),
    };
  }

  private async addDependencies(serviceId: number, dependencyIds: number[]) {
    // Verify all dependency services exist
    const dependencyServices = await this.db
      .select()
      .from(services)
      .where(inArray(services.id, dependencyIds));

    if (dependencyServices.length !== dependencyIds.length) {
      throw new NotFoundException('One or more dependency services not found');
    }

    // Prevent self-dependency
    if (dependencyIds.includes(serviceId)) {
      throw new BadRequestException('A service cannot depend on itself');
    }

    // Check for circular dependencies
    for (const depId of dependencyIds) {
      const wouldCreateCircle = await this.wouldCreateCircularDependency(serviceId, depId);
      if (wouldCreateCircle) {
        throw new BadRequestException(
          `Adding dependency to service ${depId} would create a circular reference`,
        );
      }
    }

    // Add dependencies
    await this.db.insert(serviceDependencies).values(
      dependencyIds.map((depId) => ({
        serviceId,
        dependsOnServiceId: depId,
      })),
    );
  }

  private async wouldCreateCircularDependency(
    serviceId: number,
    dependsOnServiceId: number,
  ): Promise<boolean> {
    // Check if dependsOnServiceId eventually depends on serviceId
    const visited = new Set<number>();
    const queue = [dependsOnServiceId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === serviceId) {
        return true; // Found a circular dependency
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Get all dependencies of current service
      const deps = await this.db
        .select()
        .from(serviceDependencies)
        .where(eq(serviceDependencies.serviceId, currentId));

      queue.push(...deps.map((d) => d.dependsOnServiceId));
    }

    return false;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
