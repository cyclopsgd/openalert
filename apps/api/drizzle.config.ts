import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL || 'postgresql://openalert:openalert_dev@localhost:5432/openalert',
  },
  verbose: true,
  strict: true,
} satisfies Config;
