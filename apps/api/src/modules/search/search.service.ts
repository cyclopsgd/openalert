import { Injectable, Logger } from '@nestjs/common';
import { sql, or, ilike } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { incidents, alerts, services, teams, users } from '../../database/schema';

export interface SearchResult {
  incidents: Array<{
    id: number;
    incidentNumber: number;
    title: string;
    status: string;
    severity: string;
    serviceId: number;
    triggeredAt: string;
  }>;
  alerts: Array<{
    id: number;
    title: string;
    description: string | null;
    status: string;
    severity: string;
    firedAt: string;
  }>;
  services: Array<{
    id: number;
    name: string;
    slug: string;
    description: string | null;
    teamId: number;
  }>;
  teams: Array<{
    id: number;
    name: string;
    slug: string;
    description: string | null;
  }>;
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly db: DatabaseService) {}

  async search(query: string, limit: number = 10): Promise<SearchResult> {
    if (!query || query.trim().length < 2) {
      return this.emptyResult();
    }

    const searchTerm = query.trim();
    this.logger.debug(`Searching for: ${searchTerm}`);

    // Search in parallel for better performance
    const [
      incidentsResult,
      alertsResult,
      servicesResult,
      teamsResult,
      usersResult,
    ] = await Promise.all([
      this.searchIncidents(searchTerm, limit),
      this.searchAlerts(searchTerm, limit),
      this.searchServices(searchTerm, limit),
      this.searchTeams(searchTerm, limit),
      this.searchUsers(searchTerm, limit),
    ]);

    return {
      incidents: incidentsResult,
      alerts: alertsResult,
      services: servicesResult,
      teams: teamsResult,
      users: usersResult,
    };
  }

  private async searchIncidents(query: string, limit: number) {
    try {
      // Search by incident number if query is numeric
      const incidentNumber = parseInt(query, 10);

      if (!isNaN(incidentNumber)) {
        // Search by exact incident number
        const result = await this.db.db
          .select({
            id: incidents.id,
            incidentNumber: incidents.incidentNumber,
            title: incidents.title,
            status: incidents.status,
            severity: incidents.severity,
            serviceId: incidents.serviceId,
            triggeredAt: incidents.triggeredAt,
          })
          .from(incidents)
          .where(sql`${incidents.incidentNumber} = ${incidentNumber}`)
          .limit(limit);

        if (result.length > 0) {
          return result.map(r => ({
            ...r,
            triggeredAt: r.triggeredAt?.toISOString() || '',
          }));
        }
      }

      // Search by title
      const result = await this.db.db
        .select({
          id: incidents.id,
          incidentNumber: incidents.incidentNumber,
          title: incidents.title,
          status: incidents.status,
          severity: incidents.severity,
          serviceId: incidents.serviceId,
          triggeredAt: incidents.triggeredAt,
        })
        .from(incidents)
        .where(sql`${incidents.title} ILIKE ${`%${query}%`}`)
        .orderBy(sql`${incidents.triggeredAt} DESC`)
        .limit(limit);

      return result.map(r => ({
        ...r,
        triggeredAt: r.triggeredAt?.toISOString() || '',
      }));
    } catch (error) {
      this.logger.error('Error searching incidents:', error);
      return [];
    }
  }

  private async searchAlerts(query: string, limit: number) {
    try {
      const result = await this.db.db
        .select({
          id: alerts.id,
          title: alerts.title,
          description: alerts.description,
          status: alerts.status,
          severity: alerts.severity,
          firedAt: alerts.firedAt,
        })
        .from(alerts)
        .where(
          or(
            sql`${alerts.title} ILIKE ${`%${query}%`}`,
            sql`${alerts.description} ILIKE ${`%${query}%`}`
          )
        )
        .orderBy(sql`${alerts.firedAt} DESC`)
        .limit(limit);

      return result.map(r => ({
        ...r,
        firedAt: r.firedAt?.toISOString() || '',
      }));
    } catch (error) {
      this.logger.error('Error searching alerts:', error);
      return [];
    }
  }

  private async searchServices(query: string, limit: number) {
    try {
      const result = await this.db.db
        .select({
          id: services.id,
          name: services.name,
          slug: services.slug,
          description: services.description,
          teamId: services.teamId,
        })
        .from(services)
        .where(
          or(
            sql`${services.name} ILIKE ${`%${query}%`}`,
            sql`${services.description} ILIKE ${`%${query}%`}`
          )
        )
        .orderBy(sql`${services.name} ASC`)
        .limit(limit);

      return result;
    } catch (error) {
      this.logger.error('Error searching services:', error);
      return [];
    }
  }

  private async searchTeams(query: string, limit: number) {
    try {
      const result = await this.db.db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          description: teams.description,
        })
        .from(teams)
        .where(
          or(
            sql`${teams.name} ILIKE ${`%${query}%`}`,
            sql`${teams.description} ILIKE ${`%${query}%`}`
          )
        )
        .orderBy(sql`${teams.name} ASC`)
        .limit(limit);

      return result;
    } catch (error) {
      this.logger.error('Error searching teams:', error);
      return [];
    }
  }

  private async searchUsers(query: string, limit: number) {
    try {
      const result = await this.db.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(
          or(
            sql`${users.name} ILIKE ${`%${query}%`}`,
            sql`${users.email} ILIKE ${`%${query}%`}`
          )
        )
        .orderBy(sql`${users.name} ASC`)
        .limit(limit);

      return result;
    } catch (error) {
      this.logger.error('Error searching users:', error);
      return [];
    }
  }

  private emptyResult(): SearchResult {
    return {
      incidents: [],
      alerts: [],
      services: [],
      teams: [],
      users: [],
    };
  }
}
