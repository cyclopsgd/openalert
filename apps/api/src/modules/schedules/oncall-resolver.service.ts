import { Injectable, Logger } from '@nestjs/common';
import { eq, and, gte, lte, isNull, or } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { scheduleRotations, rotationMembers, scheduleOverrides } from '../../database/schema';

export interface OnCallResult {
  scheduleId: number;
  scheduleName: string;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  source: 'override' | 'rotation';
  rotationId?: number;
  rotationName?: string;
  overrideId?: number;
  overrideReason?: string;
}

@Injectable()
export class OnCallResolverService {
  private readonly logger = new Logger(OnCallResolverService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Determine who is on call for a schedule at a specific time
   */
  async resolveOnCall(scheduleId: number, at: Date = new Date()): Promise<OnCallResult | null> {
    this.logger.debug(`Resolving on-call for schedule ${scheduleId} at ${at.toISOString()}`);

    // 1. Check for active override first (highest priority)
    const override = await this.getActiveOverride(scheduleId, at);
    if (override) {
      return {
        scheduleId,
        scheduleName: override.schedule.name,
        userId: override.userId,
        user: {
          id: override.user.id,
          name: override.user.name,
          email: override.user.email,
        },
        source: 'override',
        overrideId: override.id,
        overrideReason: override.reason || undefined,
      };
    }

    // 2. Find active rotation and determine current on-call user
    const rotationUser = await this.getActiveRotationUser(scheduleId, at);
    if (rotationUser) {
      return rotationUser;
    }

    // No one is on call
    this.logger.warn(`No on-call user found for schedule ${scheduleId} at ${at.toISOString()}`);
    return null;
  }

  /**
   * Get who's on call for multiple schedules
   */
  async resolveMultipleSchedules(
    scheduleIds: number[],
    at: Date = new Date(),
  ): Promise<OnCallResult[]> {
    const results = await Promise.all(
      scheduleIds.map((scheduleId) => this.resolveOnCall(scheduleId, at)),
    );

    return results.filter((result) => result !== null) as OnCallResult[];
  }

  /**
   * Check for active override at given time
   */
  private async getActiveOverride(scheduleId: number, at: Date) {
    return this.db.db.query.scheduleOverrides.findFirst({
      where: and(
        eq(scheduleOverrides.scheduleId, scheduleId),
        lte(scheduleOverrides.startTime, at),
        gte(scheduleOverrides.endTime, at),
      ),
      with: {
        user: true,
        schedule: true,
      },
    });
  }

  /**
   * Find active rotation and calculate current on-call user
   */
  private async getActiveRotationUser(
    scheduleId: number,
    at: Date,
  ): Promise<OnCallResult | null> {
    // Find all active rotations for this schedule
    const activeRotations = await this.db.db.query.scheduleRotations.findMany({
      where: and(
        eq(scheduleRotations.scheduleId, scheduleId),
        lte(scheduleRotations.effectiveFrom, at),
        or(isNull(scheduleRotations.effectiveUntil), gte(scheduleRotations.effectiveUntil, at)),
      ),
      with: {
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.position)],
        },
        schedule: true,
      },
    });

    if (activeRotations.length === 0) {
      return null;
    }

    // Use first active rotation (could be extended to handle multiple layers)
    const rotation = activeRotations[0];

    if (rotation.members.length === 0) {
      this.logger.warn(`Rotation ${rotation.id} has no members`);
      return null;
    }

    // Calculate which member is on call based on rotation type
    const onCallIndex = this.calculateOnCallIndex(rotation, at);
    const onCallMember = rotation.members[onCallIndex];

    return {
      scheduleId,
      scheduleName: rotation.schedule.name,
      userId: onCallMember.userId,
      user: {
        id: onCallMember.user.id,
        name: onCallMember.user.name,
        email: onCallMember.user.email,
      },
      source: 'rotation',
      rotationId: rotation.id,
      rotationName: rotation.name || undefined,
    };
  }

  /**
   * Calculate which member index is currently on call
   */
  private calculateOnCallIndex(rotation: any, at: Date): number {
    const memberCount = rotation.members.length;
    const effectiveFrom = new Date(rotation.effectiveFrom);

    // Get timezone from schedule (use UTC if not set)
    const timezone = rotation.schedule?.timezone || 'UTC';

    // Convert times to schedule timezone
    const atInTz = this.toScheduleTimezone(at, timezone);
    const fromInTz = this.toScheduleTimezone(effectiveFrom, timezone);

    switch (rotation.rotationType) {
      case 'daily':
        return this.calculateDailyRotation(fromInTz, atInTz, rotation.handoffTime, memberCount);

      case 'weekly':
        return this.calculateWeeklyRotation(
          fromInTz,
          atInTz,
          rotation.handoffTime,
          rotation.handoffDay || 0,
          memberCount,
        );

      case 'custom':
        // For custom rotations, default to daily until we implement custom recurrence rules
        return this.calculateDailyRotation(fromInTz, atInTz, rotation.handoffTime, memberCount);

      default:
        return 0;
    }
  }

  /**
   * Calculate on-call index for daily rotation
   */
  private calculateDailyRotation(
    effectiveFrom: Date,
    at: Date,
    handoffTime: string,
    memberCount: number,
  ): number {
    // Calculate number of handoffs that have occurred
    const [handoffHour, handoffMinute] = handoffTime.split(':').map(Number);

    // Create handoff time for "at" date
    const todayHandoff = new Date(at);
    todayHandoff.setHours(handoffHour, handoffMinute, 0, 0);

    // Create handoff time for effective from date
    const startHandoff = new Date(effectiveFrom);
    startHandoff.setHours(handoffHour, handoffMinute, 0, 0);

    // If effective from is after today's handoff, start from next day
    const effectiveStart = effectiveFrom > startHandoff ?
      new Date(startHandoff.getTime() + 24 * 60 * 60 * 1000) :
      startHandoff;

    // If current time is before today's handoff, use previous handoff
    const currentHandoff = at < todayHandoff ?
      new Date(todayHandoff.getTime() - 24 * 60 * 60 * 1000) :
      todayHandoff;

    // Calculate days between effective start and current handoff
    const daysDiff = Math.floor(
      (currentHandoff.getTime() - effectiveStart.getTime()) / (24 * 60 * 60 * 1000),
    );

    return daysDiff % memberCount;
  }

  /**
   * Calculate on-call index for weekly rotation
   */
  private calculateWeeklyRotation(
    effectiveFrom: Date,
    at: Date,
    handoffTime: string,
    handoffDay: number,
    memberCount: number,
  ): number {
    const [handoffHour, handoffMinute] = handoffTime.split(':').map(Number);

    // Find the most recent handoff day/time before or at "at"
    const currentHandoff = this.findMostRecentHandoff(at, handoffDay, handoffHour, handoffMinute);

    // Find the first handoff on or after effective from
    const startHandoff = this.findNextHandoff(
      effectiveFrom,
      handoffDay,
      handoffHour,
      handoffMinute,
    );

    // Calculate weeks between handoffs
    const weeksDiff = Math.floor(
      (currentHandoff.getTime() - startHandoff.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    return weeksDiff % memberCount;
  }

  /**
   * Find most recent handoff time before or at given date
   */
  private findMostRecentHandoff(
    date: Date,
    dayOfWeek: number,
    hour: number,
    minute: number,
  ): Date {
    const result = new Date(date);
    const currentDay = result.getDay();

    // Calculate days to go back
    let daysBack = currentDay - dayOfWeek;
    if (daysBack < 0) daysBack += 7;

    result.setDate(result.getDate() - daysBack);
    result.setHours(hour, minute, 0, 0);

    // If this handoff is in the future, go back one more week
    if (result > date) {
      result.setDate(result.getDate() - 7);
    }

    return result;
  }

  /**
   * Find next handoff time on or after given date
   */
  private findNextHandoff(date: Date, dayOfWeek: number, hour: number, minute: number): Date {
    const result = new Date(date);
    const currentDay = result.getDay();

    // Calculate days to add
    let daysForward = dayOfWeek - currentDay;
    if (daysForward < 0) daysForward += 7;

    result.setDate(result.getDate() + daysForward);
    result.setHours(hour, minute, 0, 0);

    // If this handoff is before the effective date, add one week
    if (result < date) {
      result.setDate(result.getDate() + 7);
    }

    return result;
  }

  /**
   * Convert Date to schedule timezone (simplified - in production use proper timezone library)
   */
  private toScheduleTimezone(date: Date, timezone: string): Date {
    // For MVP, we'll work with UTC and assume timezone offsets
    // In production, use libraries like date-fns-tz or luxon
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  }
}
