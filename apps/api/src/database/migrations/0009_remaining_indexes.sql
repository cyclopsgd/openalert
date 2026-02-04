-- Add remaining performance indexes that require correct schema

-- Status Page Components: Page + position ordering (if status column exists)
CREATE INDEX IF NOT EXISTS status_page_components_status_page_position_idx
ON status_page_components(status_page_id, position);

-- Users: Active + role lookup (partial index) - NOW THAT ROLE COLUMN EXISTS
CREATE INDEX IF NOT EXISTS users_active_role_idx
ON users(is_active, role) WHERE is_active = true;

-- Note: Audit logs indexes omitted since audit_logs table doesn't exist yet
-- Will need to be added when audit_logs table is created
