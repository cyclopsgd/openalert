import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';
import { sql } from 'drizzle-orm';

let app: INestApplication;
let moduleRef: TestingModule;

/**
 * Initialize the test application
 */
export async function initializeTestApp(): Promise<INestApplication> {
  if (app) {
    return app;
  }

  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();

  // Apply global validation pipe (same as main.ts)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}

/**
 * Get the test application instance
 */
export function getTestApp(): INestApplication {
  if (!app) {
    throw new Error('Test app not initialized. Call initializeTestApp() first.');
  }
  return app;
}

/**
 * Clean up the database after tests
 */
export async function cleanupDatabase(): Promise<void> {
  if (!app) return;

  const db = app.get(DatabaseService);
  const database = db.getDatabase();

  // Disable foreign key checks temporarily
  await database.execute(sql`SET session_replication_role = 'replica'`);

  // Delete all data from tables (order matters for foreign keys)
  const tables = [
    'alert_routing_actions',
    'alert_routing_rules',
    'status_page_services',
    'status_page_incidents',
    'status_pages',
    'escalation_level_targets',
    'escalation_levels',
    'escalation_policies',
    'incident_logs',
    'incident_assignments',
    'incidents',
    'alerts',
    'schedule_overrides',
    'schedule_rotations',
    'schedules',
    'service_dependencies',
    'services',
    'team_members',
    'teams',
    'integrations',
    'notification_logs',
    'users',
    'system_settings',
  ];

  for (const table of tables) {
    try {
      await database.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`));
    } catch (error) {
      // Table might not exist, ignore
      console.warn(`Failed to truncate table ${table}:`, error.message);
    }
  }

  // Re-enable foreign key checks
  await database.execute(sql`SET session_replication_role = 'origin'`);
}

/**
 * Close the test application
 */
export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    moduleRef = null;
  }
}

/**
 * Get a service from the test application
 */
export function getService<T>(serviceClass: new (...args: any[]) => T): T {
  if (!app) {
    throw new Error('Test app not initialized. Call initializeTestApp() first.');
  }
  return app.get(serviceClass);
}
