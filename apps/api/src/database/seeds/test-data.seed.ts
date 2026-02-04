import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import * as schema from '../schema';
import { config } from 'dotenv';

// Load environment variables
config();

const { teams, teamMembers, services, integrations, incidents, alerts, incidentTimeline } = schema;

async function seedTestData() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'openalert',
    password: process.env.POSTGRES_PASSWORD || 'openalert_dev',
    database: process.env.POSTGRES_DB || 'openalert',
  });

  const db = drizzle(pool, { schema });

  try {
    console.log('Starting test data seed...');

    // Check if test user exists (userId 3, email: test@openalert.com)
    const testUser = await db.query.users.findFirst({
      where: eq(schema.users.email, 'test@openalert.com'),
    });

    if (!testUser) {
      console.error('Test user (test@openalert.com) not found. Please create it first.');
      process.exit(1);
    }

    console.log(`Found test user: ${testUser.email} (ID: ${testUser.id})`);

    // Check if team already exists
    let team = await db.query.teams.findFirst({
      where: eq(teams.slug, 'test-team'),
    });

    if (!team) {
      console.log('Creating test team...');
      const [newTeam] = await db
        .insert(teams)
        .values({
          name: 'Test Team',
          slug: 'test-team',
          description: 'Test team for development',
        })
        .returning();
      team = newTeam;
      console.log(`Created team: ${team.name} (ID: ${team.id})`);
    } else {
      console.log(`Team already exists: ${team.name} (ID: ${team.id})`);
    }

    // Check if team membership exists
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, testUser.id)),
    });

    if (!membership) {
      console.log('Adding test user to team...');
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: testUser.id,
        teamRole: 'team_admin',
      });
      console.log('Test user added to team as admin');
    } else {
      console.log('Test user already a member of the team');
    }

    // Check if service already exists
    let service = await db.query.services.findFirst({
      where: eq(services.slug, 'test-service'),
    });

    if (!service) {
      console.log('Creating test service...');
      const [newService] = await db
        .insert(services)
        .values({
          name: 'Test Service',
          slug: 'test-service',
          description: 'Test service for development',
          teamId: team.id,
        })
        .returning();
      service = newService;
      console.log(`Created service: ${service.name} (ID: ${service.id})`);
    } else {
      console.log(`Service already exists: ${service.name} (ID: ${service.id})`);
    }

    // Check if integration already exists
    let integration = await db.query.integrations.findFirst({
      where: eq(integrations.integrationKey, 'test-integration-key'),
    });

    if (!integration) {
      console.log('Creating test integration...');
      const [newIntegration] = await db
        .insert(integrations)
        .values({
          name: 'Test Prometheus',
          type: 'prometheus',
          serviceId: service.id,
          integrationKey: 'test-integration-key',
          isActive: true,
        })
        .returning();
      integration = newIntegration;
      console.log(`Created integration: ${integration.name} (ID: ${integration.id})`);
    } else {
      console.log(`Integration already exists: ${integration.name} (ID: ${integration.id})`);
    }

    // Create test incidents (only if they don't exist)
    const existingIncidents = await db.query.incidents.findMany({
      where: eq(incidents.serviceId, service.id),
    });

    if (existingIncidents.length === 0) {
      console.log('Creating test incidents...');

      const testIncidents = [
        {
          title: 'Database connection pool exhausted',
          severity: 'critical' as const,
          status: 'triggered' as const,
          description: 'PostgreSQL connection pool has reached max capacity',
        },
        {
          title: 'High API response time detected',
          severity: 'high' as const,
          status: 'acknowledged' as const,
          description: 'API endpoints responding slower than 2s threshold',
        },
        {
          title: 'Disk usage above 80%',
          severity: 'medium' as const,
          status: 'resolved' as const,
          description: 'Server disk usage has exceeded warning threshold',
        },
        {
          title: 'SSL certificate expiring soon',
          severity: 'low' as const,
          status: 'triggered' as const,
          description: 'SSL certificate will expire in 14 days',
        },
        {
          title: 'Memory usage increased',
          severity: 'info' as const,
          status: 'resolved' as const,
          description: 'Memory usage pattern has changed, monitoring',
        },
      ];

      for (const incidentData of testIncidents) {
        // Create incident
        const [incident] = await db
          .insert(incidents)
          .values({
            title: incidentData.title,
            severity: incidentData.severity,
            status: incidentData.status,
            serviceId: service.id,
            acknowledgedById:
              incidentData.status === 'acknowledged' || incidentData.status === 'resolved'
                ? testUser.id
                : undefined,
            resolvedById: incidentData.status === 'resolved' ? testUser.id : undefined,
            acknowledgedAt:
              incidentData.status === 'acknowledged' || incidentData.status === 'resolved'
                ? new Date(Date.now() - 2 * 60 * 60 * 1000)
                : undefined,
            resolvedAt:
              incidentData.status === 'resolved'
                ? new Date(Date.now() - 1 * 60 * 60 * 1000)
                : undefined,
            triggeredAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          })
          .returning();

        console.log(`Created incident #${incident.incidentNumber}: ${incident.title}`);

        // Create alert for this incident
        await db
          .insert(alerts)
          .values({
            fingerprint: `test-${incident.id}-${Date.now()}`,
            integrationId: integration.id,
            incidentId: incident.id,
            status:
              incidentData.status === 'triggered'
                ? 'firing'
                : incidentData.status === 'acknowledged'
                  ? 'acknowledged'
                  : 'resolved',
            severity: incidentData.severity,
            title: incidentData.title,
            description: incidentData.description,
            source: 'Prometheus',
            labels: {
              job: 'test-service',
              instance: 'localhost:9090',
            },
            annotations: {
              summary: incidentData.title,
              description: incidentData.description,
            },
            firedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            acknowledgedAt:
              incidentData.status === 'acknowledged' || incidentData.status === 'resolved'
                ? new Date(Date.now() - 2 * 60 * 60 * 1000)
                : undefined,
            resolvedAt:
              incidentData.status === 'resolved'
                ? new Date(Date.now() - 1 * 60 * 60 * 1000)
                : undefined,
          })
          .returning();

        console.log(`Created alert for incident #${incident.incidentNumber}`);

        // Create timeline events
        await db.insert(incidentTimeline).values({
          incidentId: incident.id,
          eventType: 'triggered',
          description: `Incident triggered by alert from ${integration.name}`,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        });

        if (incidentData.status === 'acknowledged' || incidentData.status === 'resolved') {
          await db.insert(incidentTimeline).values({
            incidentId: incident.id,
            eventType: 'acknowledged',
            userId: testUser.id,
            description: `Incident acknowledged by ${testUser.name}`,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          });
        }

        if (incidentData.status === 'resolved') {
          await db.insert(incidentTimeline).values({
            incidentId: incident.id,
            eventType: 'resolved',
            userId: testUser.id,
            description: `Incident resolved by ${testUser.name}`,
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          });
        }
      }

      console.log(`Created ${testIncidents.length} test incidents with alerts and timeline`);
    } else {
      console.log(
        `Service already has ${existingIncidents.length} incidents, skipping incident creation`,
      );
    }

    console.log('\nTest data seed completed successfully!');
    console.log(`\nYou can now log in as ${testUser.email} and see the test incidents.`);
  } catch (error) {
    console.error('Error seeding test data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedTestData();
