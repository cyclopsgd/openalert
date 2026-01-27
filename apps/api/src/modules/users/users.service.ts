import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { users, User, NewUser } from '../../database/schema';

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
    let user = await this.findByExternalId(data.externalId);

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
   * List users with pagination
   */
  async list(params: { limit?: number; offset?: number } = {}) {
    return this.db.db
      .select()
      .from(users)
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(users.createdAt);
  }
}
