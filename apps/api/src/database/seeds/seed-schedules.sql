-- Seed on-call schedules and rotations
-- Run this after seed-escalation-policy.sql

DO $$
DECLARE
  v_schedule_id INTEGER;
  v_rotation_id INTEGER;
  v_alice_id INTEGER;
  v_bob_id INTEGER;
BEGIN
  -- Get user IDs
  SELECT id INTO v_alice_id FROM users WHERE email = 'alice@example.com';
  SELECT id INTO v_bob_id FROM users WHERE email = 'bob@example.com';

  -- Check if schedule already exists
  IF EXISTS (SELECT 1 FROM schedules WHERE name = 'Primary On-Call Schedule') THEN
    RAISE NOTICE 'Schedule already exists, skipping seed';
    RETURN;
  END IF;

  -- Create schedule for Team Alpha
  INSERT INTO schedules (name, team_id, timezone)
  VALUES ('Primary On-Call Schedule', 1, 'America/New_York')
  RETURNING id INTO v_schedule_id;

  RAISE NOTICE 'Created schedule with ID: %', v_schedule_id;

  -- Create weekly rotation (handoff on Monday at 9:00 AM)
  INSERT INTO schedule_rotations (
    schedule_id,
    name,
    rotation_type,
    handoff_time,
    handoff_day,
    effective_from,
    effective_until
  )
  VALUES (
    v_schedule_id,
    'Weekly Primary Rotation',
    'weekly',
    '09:00',
    1, -- Monday
    CURRENT_TIMESTAMP - INTERVAL '7 days', -- Started a week ago
    NULL -- No end date
  )
  RETURNING id INTO v_rotation_id;

  RAISE NOTICE 'Created rotation with ID: %', v_rotation_id;

  -- Add rotation members (Alice -> Bob)
  INSERT INTO rotation_members (rotation_id, user_id, position)
  VALUES
    (v_rotation_id, v_alice_id, 0),
    (v_rotation_id, v_bob_id, 1);

  RAISE NOTICE 'Added 2 members to rotation';

  -- Create a schedule override for next week (example)
  INSERT INTO schedule_overrides (
    schedule_id,
    user_id,
    start_time,
    end_time,
    reason
  )
  VALUES (
    v_schedule_id,
    v_bob_id,
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    CURRENT_TIMESTAMP + INTERVAL '8 days',
    'Covering for team member on vacation'
  );

  RAISE NOTICE 'Created schedule override';
  RAISE NOTICE 'Schedule seeding completed successfully';

END $$;
