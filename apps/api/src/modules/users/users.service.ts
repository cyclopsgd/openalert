import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { users, User, NewUser, userNotificationPreferences } from '../../database/schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  /**
   * Find user by external ID (Azure AD object ID)
   */
  async findByExternalId(externalId: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({
      where: eq(users.externalId, externalId),
    });
  }

  /**
   * Find or create user (for SSO provisioning)
   */
  async findOrCreate(data: {
    externalId: string;
    email: string;
    name: string;
    phoneNumber?: string;
  }): Promise<User> {
    // Try to find by external ID first
    const user = await this.findByExternalId(data.externalId);

    if (user) {
      // Update user info if changed
      if (user.email !== data.email || user.name !== data.name) {
        const [updated] = await this.db.db
          .update(users)
          .set({
            email: data.email,
            name: data.name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();

        this.logger.log(`Updated user ${user.id} from SSO`);
        return updated;
      }

      return user;
    }

    // Create new user
    const [newUser] = await this.db.db
      .insert(users)
      .values({
        externalId: data.externalId,
        email: data.email,
        name: data.name,
        phoneNumber: data.phoneNumber,
        isActive: true,
      })
      .returning();

    this.logger.log(`Created new user ${newUser.id} from SSO: ${newUser.email}`);
    return newUser;
  }

  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<User> {
    const [user] = await this.db.db.insert(users).values(data).returning();
    this.logger.log(`Created user ${user.id}: ${user.email}`);
    return user;
  }

  /**
   * Update user
   */
  async update(id: number, data: Partial<NewUser>): Promise<User> {
    const [updated] = await this.db.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`User ${id} not found`);
    }

    this.logger.log(`Updated user ${id}`);
    return updated;
  }

  /**
   * Deactivate user
   */
  async deactivate(id: number): Promise<User> {
    return this.update(id, { isActive: false });
  }

  /**
   * Activate user
   */
  async activate(id: number): Promise<User> {
    return this.update(id, { isActive: true });
  }

  /**
   * List users with pagination and filters
   */
  async list(
    params: {
      limit?: number;
      offset?: number;
      authProvider?: string;
      isActive?: boolean;
      role?: string;
    } = {},
  ) {
    const conditions = [];

    if (params.authProvider) {
      conditions.push(eq(users.authProvider, params.authProvider));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(users.isActive, params.isActive));
    }

    if (params.role) {
      conditions.push(eq(users.role, params.role));
    }

    const query = this.db.db
      .select()
      .from(users)
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(users.createdAt);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  /**
   * Initiate password reset for a local user
   */
  async initiatePasswordReset(id: number): Promise<{ message: string }> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (user.authProvider !== 'local') {
      throw new BadRequestException('Password reset is only available for local users');
    }

    // TODO: Generate reset token and send email
    // For now, just log it
    this.logger.log(`Password reset initiated for user ${id}: ${user.email}`);

    return {
      message: 'Password reset email sent (placeholder - email functionality not yet implemented)',
    };
  }

  /**
   * Get user's team memberships
   */
  async getUserTeams(userId: number) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        teamMemberships: {
          with: {
            team: true,
          },
        },
      },
    });

    return user?.teamMemberships || [];
  }

  /**
   * Change user's global role
   */
  async changeRole(userId: number, newRole: string, actorId: number): Promise<User> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Prevent users from changing their own role
    if (userId === actorId) {
      throw new BadRequestException('You cannot change your own role');
    }

    // Validate role
    const validRoles = ['superadmin', 'admin', 'responder', 'observer'];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    // Prevent demoting the last superadmin
    if (user.role === 'superadmin') {
      const superadminCount = await this.db.db
        .select()
        .from(users)
        .where(eq(users.role, 'superadmin'));

      if (superadminCount.length <= 1) {
        throw new BadRequestException(
          'Cannot change role of the last superadmin. Promote another user first.',
        );
      }
    }

    const [updated] = await this.db.db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    this.logger.log(`Changed role of user ${userId} to ${newRole} by user ${actorId}`);
    return updated;
  }

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(userId: number) {
    // First check if user exists
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Try to find existing preferences
    const prefs = await this.db.db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .limit(1);

    if (prefs.length > 0) {
      return {
        ...prefs[0],
        phoneNumber: user.phoneNumber,
      };
    }

    // Return default preferences if none exist
    return {
      userId,
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      slackEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      notificationDelay: 0,
      phoneNumber: user.phoneNumber,
    };
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: number,
    preferences: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      slackEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      notificationDelay?: number;
      phoneNumber?: string;
    },
  ) {
    // First check if user exists
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Update phone number on user if provided
    if (preferences.phoneNumber !== undefined) {
      await this.db.db
        .update(users)
        .set({ phoneNumber: preferences.phoneNumber || null, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    // Check if preferences exist
    const existing = await this.db.db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .limit(1);

    const prefData = {
      emailEnabled: preferences.emailEnabled,
      smsEnabled: preferences.smsEnabled,
      pushEnabled: preferences.pushEnabled,
      slackEnabled: preferences.slackEnabled,
      quietHoursStart: preferences.quietHoursStart || null,
      quietHoursEnd: preferences.quietHoursEnd || null,
      notificationDelay: preferences.notificationDelay ?? 0,
    };

    if (existing.length > 0) {
      // Update existing preferences
      const [updated] = await this.db.db
        .update(userNotificationPreferences)
        .set({ ...prefData, updatedAt: new Date() })
        .where(eq(userNotificationPreferences.userId, userId))
        .returning();

      this.logger.log(`Updated notification preferences for user ${userId}`);
      return {
        ...updated,
        phoneNumber: preferences.phoneNumber || user.phoneNumber,
      };
    } else {
      // Create new preferences
      const [created] = await this.db.db
        .insert(userNotificationPreferences)
        .values({
          userId,
          ...prefData,
        })
        .returning();

      this.logger.log(`Created notification preferences for user ${userId}`);
      return {
        ...created,
        phoneNumber: preferences.phoneNumber || user.phoneNumber,
      };
    }
  }
}
