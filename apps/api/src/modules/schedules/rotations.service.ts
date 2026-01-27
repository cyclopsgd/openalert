import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { scheduleRotations, rotationMembers } from '../../database/schema';

export interface CreateRotationDto {
  scheduleId: number;
  name?: string;
  rotationType: 'daily' | 'weekly' | 'custom';
  handoffTime: string; // HH:MM format
  handoffDay?: number; // 0-6 for weekly rotations
  effectiveFrom: Date;
  effectiveUntil?: Date;
  members: number[]; // User IDs in rotation order
}

export interface UpdateRotationDto {
  name?: string;
  handoffTime?: string;
  handoffDay?: number;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}

@Injectable()
export class RotationsService {
  private readonly logger = new Logger(RotationsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new rotation with members
   */
  async create(data: CreateRotationDto) {
    this.logger.log(`Creating ${data.rotationType} rotation for schedule ${data.scheduleId}`);

    // Validate handoff time format
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.handoffTime)) {
      throw new BadRequestException('Handoff time must be in HH:MM format (00:00 - 23:59)');
    }

    // Validate weekly rotation has handoff day
    if (data.rotationType === 'weekly' && data.handoffDay === undefined) {
      throw new BadRequestException('Weekly rotations require handoffDay (0-6)');
    }

    // Validate members array
    if (!data.members || data.members.length === 0) {
      throw new BadRequestException('Rotation must have at least one member');
    }

    // Create rotation
    const [rotation] = await this.db.db
      .insert(scheduleRotations)
      .values({
        scheduleId: data.scheduleId,
        name: data.name,
        rotationType: data.rotationType,
        handoffTime: data.handoffTime,
        handoffDay: data.handoffDay,
        effectiveFrom: data.effectiveFrom,
        effectiveUntil: data.effectiveUntil,
      })
      .returning();

    // Add members in order
    const memberInserts = data.members.map((userId, index) => ({
      rotationId: rotation.id,
      userId,
      position: index,
    }));

    await this.db.db.insert(rotationMembers).values(memberInserts);

    this.logger.log(`Created rotation ${rotation.id} with ${data.members.length} members`);

    return this.findById(rotation.id);
  }

  /**
   * Get rotation by ID with members
   */
  async findById(id: number) {
    const rotation = await this.db.db.query.scheduleRotations.findFirst({
      where: eq(scheduleRotations.id, id),
      with: {
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.position)],
        },
      },
    });

    if (!rotation) {
      throw new NotFoundException(`Rotation with ID ${id} not found`);
    }

    return rotation;
  }

  /**
   * Update rotation details (does not modify members)
   */
  async update(id: number, data: UpdateRotationDto) {
    this.logger.log(`Updating rotation ${id}`);

    // Validate handoff time if provided
    if (data.handoffTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.handoffTime)) {
      throw new BadRequestException('Handoff time must be in HH:MM format (00:00 - 23:59)');
    }

    const [updated] = await this.db.db
      .update(scheduleRotations)
      .set(data)
      .where(eq(scheduleRotations.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Rotation with ID ${id} not found`);
    }

    return this.findById(id);
  }

  /**
   * Update rotation member order
   */
  async updateMembers(rotationId: number, userIds: number[]) {
    this.logger.log(`Updating members for rotation ${rotationId}`);

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('Rotation must have at least one member');
    }

    // Delete existing members
    await this.db.db.delete(rotationMembers).where(eq(rotationMembers.rotationId, rotationId));

    // Insert new members in order
    const memberInserts = userIds.map((userId, index) => ({
      rotationId,
      userId,
      position: index,
    }));

    await this.db.db.insert(rotationMembers).values(memberInserts);

    this.logger.log(`Updated rotation ${rotationId} with ${userIds.length} members`);

    return this.findById(rotationId);
  }

  /**
   * Delete rotation (cascades to members)
   */
  async delete(id: number) {
    this.logger.log(`Deleting rotation ${id}`);

    const result = await this.db.db
      .delete(scheduleRotations)
      .where(eq(scheduleRotations.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Rotation with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Add a member to rotation (appends to end)
   */
  async addMember(rotationId: number, userId: number) {
    this.logger.log(`Adding user ${userId} to rotation ${rotationId}`);

    // Get current max position
    const existingMembers = await this.db.db.query.rotationMembers.findMany({
      where: eq(rotationMembers.rotationId, rotationId),
      orderBy: (members, { desc }) => [desc(members.position)],
    });

    const nextPosition = existingMembers.length > 0 ? existingMembers[0].position + 1 : 0;

    await this.db.db.insert(rotationMembers).values({
      rotationId,
      userId,
      position: nextPosition,
    });

    return this.findById(rotationId);
  }

  /**
   * Remove a member from rotation
   */
  async removeMember(rotationId: number, userId: number) {
    this.logger.log(`Removing user ${userId} from rotation ${rotationId}`);

    const result = await this.db.db
      .delete(rotationMembers)
      .where(
        eq(rotationMembers.rotationId, rotationId) &&
          eq(rotationMembers.userId, userId) as any,
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Member not found in rotation`);
    }

    // Reorder remaining members
    const remaining = await this.db.db.query.rotationMembers.findMany({
      where: eq(rotationMembers.rotationId, rotationId),
      orderBy: (members, { asc }) => [asc(members.position)],
    });

    // Update positions
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await this.db.db
          .update(rotationMembers)
          .set({ position: i })
          .where(eq(rotationMembers.id, remaining[i].id));
      }
    }

    return { success: true };
  }
}
