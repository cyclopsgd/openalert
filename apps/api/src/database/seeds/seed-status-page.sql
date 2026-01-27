-- Seed status page and components
-- Run this after seed-schedules.sql

DO $$
DECLARE
  v_status_page_id INTEGER;
BEGIN
  -- Check if status page already exists
  IF EXISTS (SELECT 1 FROM status_pages WHERE slug = 'openalert-status') THEN
    RAISE NOTICE 'Status page already exists, skipping seed';
    RETURN;
  END IF;

  -- Create status page for Team Alpha
  INSERT INTO status_pages (name, slug, team_id, description, is_public)
  VALUES (
    'OpenAlert Status',
    'openalert-status',
    1, -- Team Alpha
    'Real-time status and incident updates for OpenAlert services',
    true
  )
  RETURNING id INTO v_status_page_id;

  RAISE NOTICE 'Created status page with ID: %', v_status_page_id;

  -- Create components
  INSERT INTO status_page_components (status_page_id, name, description, status, position)
  VALUES
    (v_status_page_id, 'API', 'REST API and webhook ingestion', 'operational', 0),
    (v_status_page_id, 'Database', 'PostgreSQL database', 'operational', 1),
    (v_status_page_id, 'Notification Service', 'Email, SMS, and push notifications', 'operational', 2),
    (v_status_page_id, 'WebSocket', 'Real-time updates via WebSocket', 'operational', 3);

  RAISE NOTICE 'Created 4 components';

  -- Create a sample incident
  INSERT INTO status_page_incidents (
    status_page_id,
    title,
    status,
    impact,
    component_ids
  )
  VALUES (
    v_status_page_id,
    'Database Maintenance Completed',
    'resolved',
    'minor',
    '[2]'::jsonb -- DB component
  );

  RAISE NOTICE 'Created sample resolved incident';

  RAISE NOTICE 'Status page seeding completed successfully';

END $$;
