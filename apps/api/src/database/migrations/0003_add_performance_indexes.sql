-- Add performance indexes for frequently queried columns

-- Incidents indexes
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status) WHERE status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_service_id ON incidents(service_id);
CREATE INDEX IF NOT EXISTS idx_incidents_triggered_at ON incidents(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_team_service ON incidents(service_id) INCLUDE (status, severity);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status) WHERE status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_incident_id ON alerts(incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_integration_id ON alerts(integration_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- Services indexes
CREATE INDEX IF NOT EXISTS idx_services_team_id ON services(team_id);
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_user_team ON team_members(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_role ON team_members(team_id, role);

-- Schedule rotations indexes
CREATE INDEX IF NOT EXISTS idx_rotations_schedule_id ON schedule_rotations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_rotations_effective ON schedule_rotations(effective_from, effective_until);

-- Rotation members indexes
CREATE INDEX IF NOT EXISTS idx_rotation_members_rotation ON rotation_members(rotation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rotation_members_user ON rotation_members(user_id);

-- Schedule overrides indexes
CREATE INDEX IF NOT EXISTS idx_overrides_schedule ON schedule_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_overrides_time_range ON schedule_overrides(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_overrides_user ON schedule_overrides(user_id);

-- Status pages indexes
CREATE INDEX IF NOT EXISTS idx_status_pages_team ON status_pages(team_id);
CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug) WHERE is_public = true;

-- Status page components indexes
CREATE INDEX IF NOT EXISTS idx_components_page ON status_page_components(status_page_id, display_order);

-- Escalation policies indexes
CREATE INDEX IF NOT EXISTS idx_escalation_team ON escalation_policies(team_id);

-- Integrations indexes
CREATE INDEX IF NOT EXISTS idx_integrations_team ON integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_integrations_key ON integrations(integration_key) WHERE enabled = true;
