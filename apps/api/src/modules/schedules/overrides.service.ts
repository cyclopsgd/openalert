import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { scheduleOverrides } from '../../database/schema';

export interface CreateOverrideDto {
  scheduleId: number;
  userId: number;
  startTime: Date;
  endTime: Date;
  reason?: string;
}

export interface UpdateOverrideDto {
  userId?: number;
  startTime?: Date;
  endTime?: Date;
  reason?: string;
}

@Injectable()
export class OverridesService {
  private readonly logger = new Logger(OverridesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a schedule override (e.g., vacation coverage)
   */
  async create(data: CreateOverrideDto) {
    this.logger.log(
      `Creating override for schedule ${data.scheduleId}: user ${data.userId} from ${data.startTime} to ${data.endTime}`,
    );

    // Validate time range
    if (data.endTime <= data.startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check for overlapping overrides
    const overlapping = await this.findOverlapping(data.scheduleId, data.startTime, data.endTime);

    if (overlapping.length > 0) {
      this.logger.warn(`Override overlaps with ${overlapping.length} existing override(s)`);
      // Allow overlaps but log warning - last override wins
    }

    const [override] = await this.db.db
      .insert(scheduleOverrides)
      .values({
        scheduleId: data.scheduleId,
        userId: data.userId,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason,
      })
      .returning();

    return this.findById(override.id);
  }

  /**
   * Get override by ID
   */
  async findById(id: number) {
    const override = await this.db.db.query.scheduleOverrides.findFirst({
      where: eq(scheduleOverrides.id, id),
      with: {
        user: true,
        schedule: true,
      },
    });

    if (!override) {
      throw new NotFoundException(`Override with ID ${id} not found`);
    }

    return override;
  }

  /**
   * List overrides for a schedule
   */
  async findBySchedule(
    scheduleId: number,
    options?: {
      includePast?: boolean;
      from?: Date;
      to?: Date;
    },
  ) {
    const now = new Date();
    const conditions = [eq(scheduleOverrides.scheduleId, scheduleId)];

    if (!options?.includePast) {
      // Only show current and future overrides
      conditions.push(gte(scheduleOverrides.endTime, options?.from || now));
    }

    if (options?.from) {
      conditions.push(gte(scheduleOverrides.startTime, options.from));
    }

    if (options?.to) {
      conditions.push(lte(scheduleOverrides.endTime, options.to));
    }

    return this.db.db.query.scheduleOverrides.findMany({
      where: and(...conditions),
      with: {
        user: true,
      },
      orderBy: (overrides, { asc }) => [asc(overrides.startTime)],
    });
  }

  /**
   * Find overlapping overrides for a time range
   */
  private async findOverlapping(scheduleId: number, startTime: Date, endTime: Date) {
    return this.db.db.query.scheduleOverrides.findMany({
      where: and(
        eq(scheduleOverrides.scheduleId, scheduleId),
        or(
          // New override starts during existing override
          and(
            lte(scheduleOverrides.startTime, startTime),
            gte(scheduleOverrides.endTime, startTime),
          ),
          // New override ends during existing override
          and(lte(scheduleOverrides.startTime, endTime), gte(scheduleOverrides.endTime, endTime)),
          // New override completely contains existing override
          and(gte(scheduleOverrides.startTime, startTime), lte(scheduleOverrides.endTime, endTime)),
        ),
      ),
    });
  }

  /**
   * Get active override for a schedule at a specific time
   */
  async getActiveOverride(scheduleId: number, at: Date = new Date()) {
    return this.db.db.query.scheduleOverrides.findFirst({
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
   * Update override
   */
  async update(id: number, data: UpdateOverrideDto) {
    this.logger.log(`Updating override ${id}`);

    // Validate time range if both are provided
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const [updated] = await this.db.db
      .update(scheduleOverrides)
      .set(data)
      .where(eq(scheduleOverrides.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Override with ID ${id} not found`);
    }

    return this.findById(id);
  }

  /**
   * Delete override
   */
  async delete(id: number) {
    this.logger.log(`Deleting override ${id}`);

    const result = await this.db.db
      .delete(scheduleOverrides)
      .where(eq(scheduleOverrides.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Override with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Delete all past overrides for a schedule (cleanup)
   */
  async deletePast(scheduleId: number, before: Date = new Date()) {
    this.logger.log(`Deleting past overrides for schedule ${scheduleId}`);

    const result = await this.db.db
      .delete(scheduleOverrides)
      .where(
        and(eq(scheduleOverrides.scheduleId, scheduleId), lte(scheduleOverrides.endTime, before)),
      )
      .returning();

    this.logger.log(`Deleted ${result.length} past override(s)`);

    return { deleted: result.length };
  }
}
