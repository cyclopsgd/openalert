-- Add comprehensive performance indexes for optimal query performance
-- Based on analysis of query patterns across all services

-- ============================================================================
-- CRITICAL PRIORITY INDEXES
-- ============================================================================

-- Incidents: Multi-column composite for list queries (service + status + sort)
CREATE INDEX IF NOT EXISTS incidents_service_status_triggered_idx
ON incidents(service_id, status, triggered_at DESC);

-- Incidents: Severity-based filtering and sorting
CREATE INDEX IF NOT EXISTS incidents_severity_triggered_idx
ON incidents(severity, triggered_at DESC);

-- Incidents: Assignee lookup (partial index for non-null)
CREATE INDEX IF NOT EXISTS incidents_assignee_idx
ON incidents(assignee_id) WHERE assignee_id IS NOT NULL;

-- Incidents: Acknowledged by lookup (partial index)
CREATE INDEX IF NOT EXISTS incidents_acknowledged_by_idx
ON incidents(acknowledged_by_id) WHERE acknowledged_by_id IS NOT NULL;

-- Incidents: Resolved by lookup (partial index)
CREATE INDEX IF NOT EXISTS incidents_resolved_by_idx
ON incidents(resolved_by_id) WHERE resolved_by_id IS NOT NULL;

-- Alerts: Fingerprint + status for deduplication (partial for firing only)
CREATE INDEX IF NOT EXISTS alerts_fingerprint_status_idx
ON alerts(fingerprint, status) WHERE status = 'firing';

-- Alerts: Integration + status + sort for alert management
CREATE INDEX IF NOT EXISTS alerts_integration_status_idx
ON alerts(integration_id, status, fired_at DESC);

-- Alerts: Auto-resolve query optimization (partial for non-null incidents)
CREATE INDEX IF NOT EXISTS alerts_incident_status_idx
ON alerts(incident_id, status) WHERE incident_id IS NOT NULL;

-- Schedules: Rotation effective dates for on-call resolution
CREATE INDEX IF NOT EXISTS schedule_rotations_schedule_effective_idx
ON schedule_rotations(schedule_id, effective_from, effective_until);

-- Schedules: Override time range queries
CREATE INDEX IF NOT EXISTS schedule_overrides_schedule_time_idx
ON schedule_overrides(schedule_id, start_time, end_time);

-- Alert Routing: Team + enabled + priority for rule evaluation
CREATE INDEX IF NOT EXISTS alert_routing_rules_team_enabled_priority_idx
ON alert_routing_rules(team_id, enabled, priority DESC) WHERE enabled = true;

-- ============================================================================
-- HIGH PRIORITY INDEXES
-- ============================================================================

-- Services: Team + status for catalog queries
CREATE INDEX IF NOT EXISTS services_team_status_idx
ON services(team_id, status);

-- Services: Escalation policy lookup (partial index)
CREATE INDEX IF NOT EXISTS services_escalation_policy_idx
ON services(escalation_policy_id) WHERE escalation_policy_id IS NOT NULL;

-- Team Members: User reverse lookup
CREATE INDEX IF NOT EXISTS team_members_user_idx
ON team_members(user_id);

-- Team Members: Team + role filtering
CREATE INDEX IF NOT EXISTS team_members_team_role_idx
ON team_members(team_id, team_role);

-- Schedules: Team lookup
CREATE INDEX IF NOT EXISTS schedules_team_idx
ON schedules(team_id);

-- Rotation Members: Rotation + position ordering
CREATE INDEX IF NOT EXISTS rotation_members_rotation_position_idx
ON rotation_members(rotation_id, position);

-- Rotation Members: User reverse lookup
CREATE INDEX IF NOT EXISTS rotation_members_user_idx
ON rotation_members(user_id);

-- Escalation Policies: Team lookup
CREATE INDEX IF NOT EXISTS escalation_policies_team_idx
ON escalation_policies(team_id);

-- Escalation Levels: Policy + level lookup
CREATE INDEX IF NOT EXISTS escalation_levels_policy_level_idx
ON escalation_levels(policy_id, level);

-- Escalation Targets: Level lookup
CREATE INDEX IF NOT EXISTS escalation_targets_level_idx
ON escalation_targets(level_id);

-- Escalation Targets: Type + target lookup
CREATE INDEX IF NOT EXISTS escalation_targets_target_type_idx
ON escalation_targets(target_type, target_id);

-- ============================================================================
-- MEDIUM PRIORITY INDEXES
-- ============================================================================

-- Status Pages: Team lookup
CREATE INDEX IF NOT EXISTS status_pages_team_idx
ON status_pages(team_id);

-- Status Page Components: Page + position ordering
CREATE INDEX IF NOT EXISTS status_page_components_status_page_position_idx
ON status_page_components(status_page_id, position);

-- Status Page Incidents: Page + created time
CREATE INDEX IF NOT EXISTS status_page_incidents_status_page_created_idx
ON status_page_incidents(status_page_id, created_at DESC);

-- Status Page Incidents: Unresolved filter (partial index)
CREATE INDEX IF NOT EXISTS status_page_incidents_status_page_unresolved_idx
ON status_page_incidents(status_page_id) WHERE resolved_at IS NULL;

-- Status Page Services: Page + display order
CREATE INDEX IF NOT EXISTS status_page_services_status_page_order_idx
ON status_page_services(status_page_id, display_order);

-- Alert Routing Matches: Alert + matched time
CREATE INDEX IF NOT EXISTS alert_routing_matches_alert_matched_idx
ON alert_routing_matches(alert_id, matched_at DESC);

-- Alert Routing Matches: Rule stats
CREATE INDEX IF NOT EXISTS alert_routing_matches_rule_matched_idx
ON alert_routing_matches(rule_id, matched_at DESC);

-- Users: Active + role lookup (partial index)
CREATE INDEX IF NOT EXISTS users_active_role_idx
ON users(is_active, role) WHERE is_active = true;

-- Users: Auth provider lookup
CREATE INDEX IF NOT EXISTS users_auth_provider_idx
ON users(auth_provider);

-- ============================================================================
-- ANALYTICS/REPORTING INDEXES
-- ============================================================================

-- Notification Logs: User lookup
CREATE INDEX IF NOT EXISTS notification_logs_user_idx
ON notification_logs(user_id);

-- Notification Logs: Status + created time
CREATE INDEX IF NOT EXISTS notification_logs_status_created_idx
ON notification_logs(status, created_at DESC);

-- Notification Logs: Channel + sent time (partial)
CREATE INDEX IF NOT EXISTS notification_logs_channel_sent_idx
ON notification_logs(channel, sent_at DESC) WHERE sent_at IS NOT NULL;

-- Audit Logs: User + created time (partial)
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
ON audit_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Audit Logs: Team + created time (partial)
CREATE INDEX IF NOT EXISTS audit_logs_team_created_idx
ON audit_logs(team_id, created_at DESC) WHERE team_id IS NOT NULL;

-- Audit Logs: Resource lookup
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
ON audit_logs(resource_type, resource_id);

-- Incident Timeline: Incident + created time (for chronological display)
CREATE INDEX IF NOT EXISTS incident_timeline_incident_created_idx
ON incident_timeline(incident_id, created_at DESC);

-- ============================================================================
-- Comments and Performance Notes
-- ============================================================================

-- VACUUM ANALYZE after index creation
-- Run: VACUUM ANALYZE;
-- This updates query planner statistics for optimal query plans

-- Monitor index usage with:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan ASC;

-- Identify unused indexes:
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0 AND schemaname NOT IN ('pg_catalog', 'information_schema');
