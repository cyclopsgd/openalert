import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { escalationPolicies, escalationLevels, escalationTargets } from '../../database/schema';
import { CreateEscalationPolicyDto } from './dto/create-escalation-policy.dto';
import { UpdateEscalationPolicyDto } from './dto/update-escalation-policy.dto';

@Injectable()
export class EscalationPoliciesService {
  private readonly logger = new Logger(EscalationPoliciesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new escalation policy with levels and targets
   */
  async create(data: CreateEscalationPolicyDto) {
    this.logger.log(`Creating escalation policy: ${data.name}`);

    // Create policy
    const [policy] = await this.db.db
      .insert(escalationPolicies)
      .values({
        name: data.name,
        teamId: data.teamId,
        repeatCount: data.repeatCount ?? 3,
        repeatDelayMinutes: data.repeatDelayMinutes ?? 5,
      })
      .returning();

    // Create levels and targets
    for (const levelDto of data.levels) {
      const [level] = await this.db.db
        .insert(escalationLevels)
        .values({
          policyId: policy.id,
          level: levelDto.level,
          delayMinutes: levelDto.delayMinutes,
        })
        .returning();

      // Create targets for this level
      if (levelDto.targets && levelDto.targets.length > 0) {
        await this.db.db.insert(escalationTargets).values(
          levelDto.targets.map((target) => ({
            levelId: level.id,
            targetType: target.targetType,
            targetId: target.targetId,
          })),
        );
      }
    }

    return this.findById(policy.id);
  }

  /**
   * Find all escalation policies
   */
  async findAll() {
    return this.db.db.query.escalationPolicies.findMany({
      with: {
        team: true,
        levels: {
          with: {
            targets: true,
          },
          orderBy: (levels, { asc }) => [asc(levels.level)],
        },
      },
      orderBy: (policies, { desc }) => [desc(policies.createdAt)],
    });
  }

  /**
   * Find escalation policies by team
   */
  async findByTeam(teamId: number) {
    return this.db.db.query.escalationPolicies.findMany({
      where: eq(escalationPolicies.teamId, teamId),
      with: {
        levels: {
          with: {
            targets: true,
          },
          orderBy: (levels, { asc }) => [asc(levels.level)],
        },
      },
    });
  }

  /**
   * Find policy by ID with full details
   */
  async findById(id: number) {
    const policy = await this.db.db.query.escalationPolicies.findFirst({
      where: eq(escalationPolicies.id, id),
      with: {
        team: true,
        levels: {
          with: {
            targets: true,
          },
          orderBy: (levels, { asc }) => [asc(levels.level)],
        },
      },
    });

    if (!policy) {
      throw new NotFoundException(`Escalation policy with ID ${id} not found`);
    }

    return policy;
  }

  /**
   * Update escalation policy
   */
  async update(id: number, data: UpdateEscalationPolicyDto) {
    this.logger.log(`Updating escalation policy ${id}`);

    // Update basic policy info
    if (data.name || data.repeatCount !== undefined || data.repeatDelayMinutes !== undefined) {
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      if (data.repeatCount !== undefined) updateData.repeatCount = data.repeatCount;
      if (data.repeatDelayMinutes !== undefined)
        updateData.repeatDelayMinutes = data.repeatDelayMinutes;
      updateData.updatedAt = new Date();

      await this.db.db
        .update(escalationPolicies)
        .set(updateData)
        .where(eq(escalationPolicies.id, id));
    }

    // If levels are provided, replace them
    if (data.levels) {
      // Delete existing levels (cascades to targets)
      const existingPolicy = await this.findById(id);
      for (const level of existingPolicy.levels) {
        await this.db.db.delete(escalationLevels).where(eq(escalationLevels.id, level.id));
      }

      // Create new levels
      for (const levelDto of data.levels) {
        const [level] = await this.db.db
          .insert(escalationLevels)
          .values({
            policyId: id,
            level: levelDto.level,
            delayMinutes: levelDto.delayMinutes,
          })
          .returning();

        // Create targets
        if (levelDto.targets && levelDto.targets.length > 0) {
          await this.db.db.insert(escalationTargets).values(
            levelDto.targets.map((target) => ({
              levelId: level.id,
              targetType: target.targetType,
              targetId: target.targetId,
            })),
          );
        }
      }
    }

    return this.findById(id);
  }

  /**
   * Delete escalation policy
   */
  async delete(id: number) {
    this.logger.log(`Deleting escalation policy ${id}`);

    const result = await this.db.db
      .delete(escalationPolicies)
      .where(eq(escalationPolicies.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Escalation policy with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Calculate the escalation path for a policy
   */
  async getEscalationPath(id: number) {
    const policy = await this.findById(id);

    const path = policy.levels.map((level) => ({
      level: level.level,
      delayMinutes: level.delayMinutes,
      targets: level.targets.map((target) => ({
        type: target.targetType,
        id: target.targetId,
      })),
    }));

    return {
      policyId: policy.id,
      policyName: policy.name,
      repeatCount: policy.repeatCount,
      repeatDelayMinutes: policy.repeatDelayMinutes,
      path,
    };
  }
}
