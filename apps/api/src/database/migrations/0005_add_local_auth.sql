-- Add local authentication support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Make email unique (if not already)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Make external_id nullable (since local users won't have SSO external ID)
ALTER TABLE users ALTER COLUMN external_id DROP NOT NULL;

-- Update existing test users to have passwords (password: "password123")
UPDATE users SET
    password_hash = '$2b$10$rQZYvP8s0EKb4qXJ5J7KUeF5yN9hH0nLGV.xKvJ6xBQX5J7KUeFHG',
    auth_provider = 'local'
WHERE email IN ('alice@example.com', 'bob@example.com');

-- Create system settings table for SSO configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Insert default SSO settings
INSERT INTO system_settings (key, value, description)
VALUES
    ('sso_enabled', 'false', 'Enable/disable SSO authentication'),
    ('sso_enforcement', 'false', 'Require SSO for all users (disable local auth)'),
    ('azure_ad_config', '{}', 'Azure AD SSO configuration'),
    ('registration_enabled', 'true', 'Allow new user registration')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider: local, azure_ad, google, etc.';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password for local auth';
