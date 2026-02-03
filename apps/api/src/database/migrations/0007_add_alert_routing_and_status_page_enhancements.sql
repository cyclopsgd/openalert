-- Add Alert Routing Rules and Status Page Enhancements

-- Alert Routing Rules table
CREATE TABLE IF NOT EXISTS alert_routing_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  conditions JSONB,
  actions JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS alert_routing_rules_team_idx ON alert_routing_rules(team_id);
CREATE INDEX IF NOT EXISTS alert_routing_rules_priority_idx ON alert_routing_rules(priority);

-- Alert Routing Matches table
CREATE TABLE IF NOT EXISTS alert_routing_matches (
  id SERIAL PRIMARY KEY,
  alert_id INT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  rule_id INT NOT NULL REFERENCES alert_routing_rules(id) ON DELETE CASCADE,
  matched_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS alert_routing_matches_alert_idx ON alert_routing_matches(alert_id);
CREATE INDEX IF NOT EXISTS alert_routing_matches_rule_idx ON alert_routing_matches(rule_id);

-- Add theme_color to status_pages
ALTER TABLE status_pages ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7) DEFAULT '#6366f1';

-- Status Page Services linking table
CREATE TABLE IF NOT EXISTS status_page_services (
  id SERIAL PRIMARY KEY,
  status_page_id INT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  service_id INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add comments for documentation
COMMENT ON TABLE alert_routing_rules IS 'Rules for routing and transforming incoming alerts';
COMMENT ON TABLE alert_routing_matches IS 'Tracks which rules matched which alerts';
COMMENT ON TABLE status_page_services IS 'Links services to status pages for public display';
COMMENT ON COLUMN status_pages.theme_color IS 'Hex color code for status page theming';
