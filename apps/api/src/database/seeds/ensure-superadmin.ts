import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { users } from '../schema';

/**
 * Ensure at least one superadmin exists in the system
 * If no superadmin exists, promote the first user
 */
async function ensureSuperadmin() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'openalert',
    password: process.env.POSTGRES_PASSWORD || 'openalert_dev',
    database: process.env.POSTGRES_DB || 'openalert',
  });

  const db = drizzle(pool);

  try {
    // Check if any superadmin exists
    const superadmins = await db.select().from(users).where(eq(users.role, 'superadmin'));

    if (superadmins.length > 0) {
      console.log(`✅ Superadmin already exists: ${superadmins[0].email}`);
      return;
    }

    // Get the first user
    const allUsers = await db.select().from(users).limit(1);

    if (allUsers.length === 0) {
      console.log('⚠️  No users found. Please create a user first.');
      return;
    }

    const firstUser = allUsers[0];

    // Promote first user to superadmin
    await db.update(users).set({ role: 'superadmin' }).where(eq(users.id, firstUser.id));

    console.log(`✅ Promoted user ${firstUser.email} (ID: ${firstUser.id}) to superadmin`);
  } catch (error) {
    console.error('❌ Error ensuring superadmin:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  ensureSuperadmin()
    .then(() => {
      console.log('✅ Superadmin check complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to ensure superadmin:', error);
      process.exit(1);
    });
}

export { ensureSuperadmin };
