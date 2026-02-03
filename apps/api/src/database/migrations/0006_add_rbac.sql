-- Add Role-Based Access Control (RBAC) support

-- Add global role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'responder' NOT NULL;

-- Add team_role column to team_members table (rename existing 'role' if needed)
DO $$
BEGIN
    -- Check if team_members.role exists but team_role doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_members' AND column_name = 'role'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_members' AND column_name = 'team_role'
    ) THEN
        ALTER TABLE team_members RENAME COLUMN role TO team_role;
    END IF;

    -- Add team_role if it doesn't exist at all
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'team_members' AND column_name = 'team_role'
    ) THEN
        ALTER TABLE team_members ADD COLUMN team_role VARCHAR(50) DEFAULT 'member' NOT NULL;
    END IF;
END $$;

-- Create enum-like constraints for roles (optional but recommended)
DO $$
BEGIN
    -- Add constraint for user roles if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('superadmin', 'admin', 'responder', 'observer'));
    END IF;

    -- Add constraint for team roles if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'team_members_team_role_check'
    ) THEN
        ALTER TABLE team_members ADD CONSTRAINT team_members_team_role_check
        CHECK (team_role IN ('team_admin', 'member', 'observer'));
    END IF;
END $$;

-- Create index on user role for faster queries
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Promote first user to superadmin if no superadmin exists
DO $$
DECLARE
    first_user_id INT;
    superadmin_count INT;
BEGIN
    -- Check if any superadmin exists
    SELECT COUNT(*) INTO superadmin_count FROM users WHERE role = 'superadmin';

    -- If no superadmin exists, promote the first user
    IF superadmin_count = 0 THEN
        SELECT id INTO first_user_id FROM users ORDER BY id LIMIT 1;

        IF first_user_id IS NOT NULL THEN
            UPDATE users SET role = 'superadmin' WHERE id = first_user_id;
            RAISE NOTICE 'Promoted user % to superadmin', first_user_id;
        END IF;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN users.role IS 'Global user role: superadmin, admin, responder, observer';
COMMENT ON COLUMN team_members.team_role IS 'Team-specific role: team_admin, member, observer';

-- Insert RBAC configuration settings
INSERT INTO system_settings (key, value, description)
VALUES
    ('rbac_enabled', 'true', 'Enable Role-Based Access Control'),
    ('default_user_role', '"responder"', 'Default role for new users'),
    ('default_team_role', '"member"', 'Default team role for new team members')
ON CONFLICT (key) DO NOTHING;
