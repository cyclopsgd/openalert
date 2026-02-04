-- Performance Optimization Migration
-- Add composite and missing indexes for improved query performance
-- Date: 2026-02-04

-- Composite index for common incident queries (status + severity)
CREATE INDEX IF NOT EXISTS incidents_status_severity_idx
  ON incidents(status, severity);

-- Indexes for user lookups in incident detail page
CREATE INDEX IF NOT EXISTS incidents_acknowledged_by_idx
  ON incidents(acknowledged_by_id)
  WHERE acknowledged_by_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS incidents_resolved_by_idx
  ON incidents(resolved_by_id)
  WHERE resolved_by_id IS NOT NULL;

-- Composite index for alert routing rule lookups
CREATE INDEX IF NOT EXISTS alert_routing_rules_team_enabled_priority_idx
  ON alert_routing_rules(team_id, enabled, priority DESC)
  WHERE enabled = true;

-- Index for schedule override time range queries
CREATE INDEX IF NOT EXISTS schedule_overrides_schedule_time_idx
  ON schedule_overrides(schedule_id, start_time, end_time);

-- Composite index for alert deduplication lookups
CREATE INDEX IF NOT EXISTS alerts_fingerprint_status_idx
  ON alerts(fingerprint, status);

-- Index for incident assignment queries
CREATE INDEX IF NOT EXISTS incidents_assignee_status_idx
  ON incidents(assignee_id, status)
  WHERE assignee_id IS NOT NULL;

-- Index for service-team queries
CREATE INDEX IF NOT EXISTS services_team_status_idx
  ON services(team_id, status);

-- Analyze tables to update statistics
ANALYZE incidents;
ANALYZE alerts;
ANALYZE services;
ANALYZE alert_routing_rules;
ANALYZE schedule_overrides;
