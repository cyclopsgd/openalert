import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  schedules,
  scheduleRotations,
  rotationMembers,
  scheduleOverrides,
} from '../../database/schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CacheService, CACHE_PREFIX, CACHE_TTL } from '../cache/cache.service';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new on-call schedule
   */
  async create(data: CreateScheduleDto) {
    this.logger.log(`Creating schedule: ${data.name}`);

    const [schedule] = await this.db.db
      .insert(schedules)
      .values({
        name: data.name,
        teamId: data.teamId,
        timezone: data.timezone || 'UTC',
      })
      .returning();

    return schedule;
  }

  /**
   * Get schedule by ID with rotations and members
   */
  async findById(id: number) {
    const schedule = await this.db.db.query.schedules.findFirst({
      where: eq(schedules.id, id),
      with: {
        rotations: {
          with: {
            members: {
              with: {
                user: true,
              },
              orderBy: (members, { asc }) => [asc(members.position)],
            },
          },
        },
        overrides: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return schedule;
  }

  /**
   * List all schedules
   */
  async findAll() {
    return this.db.db.query.schedules.findMany({
      with: {
        team: true,
        rotations: {
          with: {
            members: {
              with: {
                user: true,
              },
              orderBy: (members, { asc }) => [asc(members.position)],
            },
          },
        },
      },
      orderBy: (schedules, { desc }) => [desc(schedules.createdAt)],
    });
  }

  /**
   * List all schedules for a team
   */
  async findByTeam(teamId: number) {
    return this.db.db.query.schedules.findMany({
      where: eq(schedules.teamId, teamId),
      with: {
        rotations: {
          with: {
            members: {
              with: {
                user: true,
              },
              orderBy: (members, { asc }) => [asc(members.position)],
            },
          },
        },
      },
    });
  }

  /**
   * Update schedule
   */
  async update(id: number, data: UpdateScheduleDto) {
    this.logger.log(`Updating schedule ${id}`);

    const [updated] = await this.db.db
      .update(schedules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schedules.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    // Invalidate schedule cache
    await this.invalidateScheduleCache(id);

    return updated;
  }

  /**
   * Delete schedule (cascades to rotations and overrides)
   */
  async delete(id: number) {
    this.logger.log(`Deleting schedule ${id}`);

    const result = await this.db.db.delete(schedules).where(eq(schedules.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Get active overrides for a schedule at a specific time
   */
  async getActiveOverrides(scheduleId: number, at: Date = new Date()) {
    return this.db.db.query.scheduleOverrides.findMany({
      where: and(
        eq(scheduleOverrides.scheduleId, scheduleId),
        lte(scheduleOverrides.startTime, at),
        gte(scheduleOverrides.endTime, at),
      ),
      with: {
        user: true,
      },
    });
  }

  /**
   * Get upcoming on-call shifts for the next N days
   */
  async getUpcomingShifts(scheduleId: number, days: number = 7) {
    const schedule = await this.findById(scheduleId);
    const shifts: Array<{
      date: string;
      user: { id: number; name: string; email: string } | null;
      rotation: string | null;
    }> = [];

    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      // For each rotation, determine who is on call
      // This is a simplified version - in production, you'd use the OnCallResolverService
      let user = null;
      let rotationName = null;

      if (schedule.rotations && schedule.rotations.length > 0) {
        const rotation = schedule.rotations[0];
        if (rotation.members && rotation.members.length > 0) {
          // Simple rotation logic - would be more complex in reality
          const daysSinceStart = Math.floor(
            (date.getTime() - new Date(rotation.effectiveFrom).getTime()) / (1000 * 60 * 60 * 24),
          );
          const memberIndex = daysSinceStart % rotation.members.length;
          const member = rotation.members[memberIndex];
          user = member.user;
          rotationName = rotation.name || 'Rotation';
        }
      }

      shifts.push({
        date: date.toISOString().split('T')[0],
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
        rotation: rotationName,
      });
    }

    return shifts;
  }

  /**
   * Invalidate schedule cache
   */
  private async invalidateScheduleCache(scheduleId: number): Promise<void> {
    await this.cacheService.delPattern(`${CACHE_PREFIX.SCHEDULES}:*:${scheduleId}`);
  }
}
