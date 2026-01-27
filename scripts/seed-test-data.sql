-- Seed test data for OpenAlert

-- Create a test team
INSERT INTO teams (name, slug, description) VALUES
  ('Platform Engineering', 'platform-eng', 'Platform and infrastructure team')
ON CONFLICT (slug) DO NOTHING;

-- Create test users
INSERT INTO users (external_id, email, name, phone_number, timezone) VALUES
  ('test-user-1', 'alice@example.com', 'Alice Smith', '+1234567890', 'America/New_York'),
  ('test-user-2', 'bob@example.com', 'Bob Johnson', '+1234567891', 'America/Los_Angeles')
ON CONFLICT (external_id) DO NOTHING;

-- Add users to team
INSERT INTO team_members (team_id, user_id, role)
SELECT t.id, u.id, 'admin'
FROM teams t
CROSS JOIN users u
WHERE t.slug = 'platform-eng'
  AND u.email IN ('alice@example.com', 'bob@example.com')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Create a test service
INSERT INTO services (name, slug, description, team_id)
SELECT 'Production API', 'prod-api', 'Main production API service', id
FROM teams
WHERE slug = 'platform-eng'
ON CONFLICT (slug) DO NOTHING;

-- Create an integration for the service
INSERT INTO integrations (name, type, service_id, integration_key, config, is_active)
SELECT
  'Prometheus Alerts',
  'prometheus',
  s.id,
  'test-integration-key-12345',
  '{"environment": "production"}'::jsonb,
  true
FROM services s
WHERE s.slug = 'prod-api'
ON CONFLICT (integration_key) DO NOTHING;

-- Display the created integration key
SELECT
  i.integration_key,
  s.name as service_name,
  t.name as team_name
FROM integrations i
JOIN services s ON i.service_id = s.id
JOIN teams t ON s.team_id = t.id
WHERE i.integration_key = 'test-integration-key-12345';
