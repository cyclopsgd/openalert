import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { eq, and, sql } from 'drizzle-orm';
import { teams, teamMembers, users, services } from '../../database/schema';

@Injectable()
export class TeamsService {
  constructor(private readonly db: DatabaseService) {}

  async create(createTeamDto: CreateTeamDto) {
    const { slug, ...teamData } = createTeamDto;

    // Generate slug from name if not provided
    const teamSlug = slug || this.generateSlug(createTeamDto.name);

    // Check if slug already exists
    const existing = await this.db.db.select().from(teams).where(eq(teams.slug, teamSlug)).limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Team with slug "${teamSlug}" already exists`);
    }

    // Create team
    const [team] = await this.db
      .insert(teams)
      .values({
        ...teamData,
        slug: teamSlug,
      })
      .returning();

    return this.findOne(team.id);
  }

  async findAll() {
    const allTeams = await this.db.db.select().from(teams);

    // Get member counts for each team
    const teamIds = allTeams.map((t) => t.id);

    if (teamIds.length === 0) {
      return [];
    }

    const memberCounts = await this.db
      .select({
        teamId: teamMembers.teamId,
        count: sql<number>`count(*)::int`,
      })
      .from(teamMembers)
      .where(sql`${teamMembers.teamId} IN ${teamIds}`)
      .groupBy(teamMembers.teamId);

    const memberCountMap = new Map(memberCounts.map((mc) => [mc.teamId, mc.count]));

    // Get service counts for each team
    const serviceCounts = await this.db
      .select({
        teamId: services.teamId,
        count: sql<number>`count(*)::int`,
      })
      .from(services)
      .where(sql`${services.teamId} IN ${teamIds}`)
      .groupBy(services.teamId);

    const serviceCountMap = new Map(serviceCounts.map((sc) => [sc.teamId, sc.count]));

    // Combine results
    return allTeams.map((team) => ({
      ...team,
      memberCount: memberCountMap.get(team.id) || 0,
      serviceCount: serviceCountMap.get(team.id) || 0,
    }));
  }

  async findOne(id: number) {
    const [team] = await this.db.db.select().from(teams).where(eq(teams.id, id)).limit(1);

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Get team members with user details
    const members = await this.db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        role: teamMembers.teamRole,
        createdAt: teamMembers.createdAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          phoneNumber: users.phoneNumber,
          timezone: users.timezone,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, id));

    // Get team services
    const teamServices = await this.db.db.select().from(services).where(eq(services.teamId, id));

    return {
      ...team,
      members,
      services: teamServices,
    };
  }

  async update(id: number, updateTeamDto: UpdateTeamDto) {
    // Verify team exists
    const existing = await this.findOne(id);

    // If slug is being updated, check for conflicts
    if (updateTeamDto.slug && updateTeamDto.slug !== existing.slug) {
      const conflict = await this.db
        .select()
        .from(teams)
        .where(eq(teams.slug, updateTeamDto.slug))
        .limit(1);

      if (conflict.length > 0) {
        throw new ConflictException(`Team with slug "${updateTeamDto.slug}" already exists`);
      }
    }

    // Update team
    await this.db
      .update(teams)
      .set({
        ...updateTeamDto,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id));

    return this.findOne(id);
  }

  async remove(id: number) {
    const team = await this.findOne(id);

    // Check if team has services
    if (team.services.length > 0) {
      throw new BadRequestException(
        'Cannot delete team with active services. Please reassign or delete services first.',
      );
    }

    await this.db.db.delete(teams).where(eq(teams.id, id));

    return { deleted: true, team };
  }

  async addMember(teamId: number, addMemberDto: AddMemberDto) {
    // Verify team exists
    await this.findOne(teamId);

    // Verify user exists
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, addMemberDto.userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${addMemberDto.userId} not found`);
    }

    // Check if user is already a member
    const existing = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, addMemberDto.userId)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('User is already a member of this team');
    }

    // Add member
    const [member] = await this.db
      .insert(teamMembers)
      .values({
        teamId,
        userId: addMemberDto.userId,
        role: addMemberDto.role || 'member',
      })
      .returning();

    // Return member with user details
    const [memberWithUser] = await this.db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        role: teamMembers.teamRole,
        createdAt: teamMembers.createdAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          phoneNumber: users.phoneNumber,
          timezone: users.timezone,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.id, member.id))
      .limit(1);

    return memberWithUser;
  }

  async removeMember(teamId: number, userId: number) {
    // Verify team exists
    await this.findOne(teamId);

    // Find member
    const [member] = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (!member) {
      throw new NotFoundException('User is not a member of this team');
    }

    // Check if this is the last admin
    const teamData = await this.findOne(teamId);
    const adminCount = teamData.members.filter((m) => m.role === 'team_admin').length;

    if (member.role === 'team_admin' && adminCount <= 1) {
      throw new BadRequestException('Cannot remove the last admin from the team');
    }

    // Remove member
    await this.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    return { deleted: true, member };
  }

  async updateMemberRole(teamId: number, userId: number, role: string) {
    // Verify team exists
    await this.findOne(teamId);

    // Find member
    const [member] = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    if (!member) {
      throw new NotFoundException('User is not a member of this team');
    }

    // If demoting from admin, check if this is the last admin
    if (member.role === 'team_admin' && role !== 'team_admin') {
      const teamData = await this.findOne(teamId);
      const adminCount = teamData.members.filter((m) => m.role === 'team_admin').length;

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin of the team');
      }
    }

    // Update role
    await this.db
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    // Return updated member with user details
    const [updatedMember] = await this.db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        role: teamMembers.teamRole,
        createdAt: teamMembers.createdAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          phoneNumber: users.phoneNumber,
          timezone: users.timezone,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1);

    return updatedMember;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
