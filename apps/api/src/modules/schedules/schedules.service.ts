import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { schedules, scheduleRotations, rotationMembers, scheduleOverrides } from '../../database/schema';

export interface CreateScheduleDto {
  name: string;
  teamId: number;
  timezone?: string;
}

export interface UpdateScheduleDto {
  name?: string;
  timezone?: string;
}

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(private readonly db: DatabaseService) {}

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
}
