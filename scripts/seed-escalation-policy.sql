-- Seed escalation policy for testing

-- Create an escalation policy for the Platform Engineering team
INSERT INTO escalation_policies (name, team_id, repeat_count, repeat_delay_minutes)
SELECT 'Critical Alerts Policy', id, 3, 5
FROM teams
WHERE slug = 'platform-eng'
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the escalation policy ID
DO $$
DECLARE
  v_policy_id INT;
  v_level1_id INT;
  v_level2_id INT;
  v_alice_id INT;
  v_bob_id INT;
BEGIN
  -- Get IDs
  SELECT id INTO v_policy_id FROM escalation_policies WHERE name = 'Critical Alerts Policy';
  SELECT id INTO v_alice_id FROM users WHERE email = 'alice@example.com';
  SELECT id INTO v_bob_id FROM users WHERE email = 'bob@example.com';

  -- Create Level 1: Notify Alice immediately
  INSERT INTO escalation_levels (policy_id, level, delay_minutes)
  VALUES (v_policy_id, 1, 0)
  ON CONFLICT (policy_id, level) DO NOTHING
  RETURNING id INTO v_level1_id;

  -- If level1_id is NULL, get it from the table
  IF v_level1_id IS NULL THEN
    SELECT id INTO v_level1_id FROM escalation_levels WHERE escalation_levels.policy_id = v_policy_id AND escalation_levels.level = 1;
  END IF;

  -- Add Alice as target for level 1
  INSERT INTO escalation_targets (level_id, target_type, target_id)
  VALUES (v_level1_id, 'user', v_alice_id)
  ON CONFLICT DO NOTHING;

  -- Create Level 2: Notify Bob after 5 minutes
  INSERT INTO escalation_levels (policy_id, level, delay_minutes)
  VALUES (v_policy_id, 2, 5)
  ON CONFLICT (policy_id, level) DO NOTHING
  RETURNING id INTO v_level2_id;

  -- If level2_id is NULL, get it from the table
  IF v_level2_id IS NULL THEN
    SELECT id INTO v_level2_id FROM escalation_levels WHERE escalation_levels.policy_id = v_policy_id AND escalation_levels.level = 2;
  END IF;

  -- Add Bob as target for level 2
  INSERT INTO escalation_targets (level_id, target_type, target_id)
  VALUES (v_level2_id, 'user', v_bob_id)
  ON CONFLICT DO NOTHING;

  -- Update service to use this escalation policy
  UPDATE services
  SET escalation_policy_id = v_policy_id
  WHERE slug = 'prod-api';

  RAISE NOTICE 'Escalation policy created successfully';
END $$;

-- Display the created policy
SELECT
  ep.id as policy_id,
  ep.name as policy_name,
  el.level,
  el.delay_minutes,
  et.target_type,
  u.name as target_name,
  u.email as target_email
FROM escalation_policies ep
JOIN escalation_levels el ON ep.id = el.policy_id
JOIN escalation_targets et ON el.id = et.level_id
LEFT JOIN users u ON et.target_type = 'user' AND et.target_id = u.id
WHERE ep.name = 'Critical Alerts Policy'
ORDER BY el.level;
