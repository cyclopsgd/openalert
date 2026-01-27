# PagerDuty Event Orchestration: Complete Technical Reference

PagerDuty Event Orchestration is a three-tier event processing engine that enables sophisticated routing, enrichment, and automation using **PagerDuty Condition Language (PCL)**. Events flow through **Global Orchestration → Router → Service Orchestration**, with each layer capable of transforming, routing, suppressing, or triggering automation. The most powerful features—cache variables, threshold conditions, scheduled rules, and dynamic routing—require the **AIOps add-on**, which starts at $699/month for 96,000 events.

---

## PCL syntax provides a complete rule language for event conditions

PagerDuty Condition Language (PCL), pronounced "pickle," is a domain-specific language that enables complex conditional logic beyond what the UI builder allows. PCL expressions evaluate against incoming events converted to **PD-CEF (Common Event Format)**.

### String comparison operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| **matches** | `field matches 'value'` | Exact string equality |
| **does not match** | `field does not match 'value'` | String inequality |
| **matches part** | `field matches part 'value'` | Contains substring |
| **does not match part** | `field does not match part 'value'` | Does not contain |
| **matches regex** | `field matches regex 'pattern'` | RE2 regex match |
| **does not match regex** | `field does not match regex 'pattern'` | Regex non-match |
| **exists** | `field exists` | Field is present |
| **does not exist** | `field does not exist` | Field is absent |

### Numeric operators for cache variables

| Operator | Syntax |
|----------|--------|
| **Greater than** | `cache_var.name > value` |
| **Greater than or equal** | `cache_var.name >= value` |
| **Less than** | `cache_var.name < value` |
| **Less than or equal** | `cache_var.name <= value` |

### Complete field reference list

**Standard PD-CEF fields** accessed with `event.` prefix:

| Field | Type | Description |
|-------|------|-------------|
| `event.summary` | String | High-level description (required) |
| `event.severity` | Enum | `info`, `warning`, `error`, `critical` |
| `event.source` | String | Affected system identifier |
| `event.component` | String | Broken subsystem |
| `event.group` | String | Cluster/grouping of sources |
| `event.class` | String | Event type classification |
| `event.dedup_key` | String | Deduplication key |
| `event.event_action` | String | `trigger` or `resolve` |
| `event.timestamp` | Timestamp | ISO-8601 format |

**Custom details** use dot-notation: `event.custom_details.field_name`, `event.custom_details.nested.field`

**Raw event payload** for non-CEF fields: `raw_event.fieldname`, `raw_event.nested.path`

**Cache variables**: `cache_var.variable_name`

**Incident fields** (for Incident Workflows): `incident.priority`, `incident.status`, `incident.custom_fields.field_name`

### Complex nested conditions with AND/OR logic

PCL supports standard boolean operators with parentheses for grouping:

```pcl
# AND combination
event.source matches 'prod' and event.severity matches 'critical'

# OR combination
event.component matches 'mysql' or event.component matches 'postgres'

# Negation
not event.severity matches 'info'

# Complex nesting with parentheses
(event.component matches 'database' and event.severity matches 'critical') 
  or (event.source matches 'mainframe' and event.class matches 'downtime')

# Negation of grouped conditions
event.source exists and not (event.severity matches 'info' or event.severity matches 'warning')
```

**Limits**: Maximum **25 condition blocks per rule**, **64 operators (AND/OR) per block**, **2048 bytes per condition block**.

### Regex support uses Google RE2 syntax

PCL uses Google's RE2 regex engine, which is fast but lacks some features like lookahead/lookbehind.

```pcl
# Basic regex patterns
event.source matches regex 'db[0-9]+-server'
event.summary matches regex '^(CRITICAL|SEVERE):'

# Case-insensitive matching
event.summary matches regex '(?i)(error|failure)'

# Digit matching
event.custom_details.error_code matches regex '\\d{4}'
```

**RE2 behaviors**:
- Case-sensitive by default (use `(?i)` for case-insensitive)
- Single-line mode (`s`) enabled: `.` matches newlines
- Multi-line mode (`m`) enabled: `^` and `$` match line boundaries
- **Nested capture groups NOT supported**: `(([0-9])[0-9])` will error
- No lookbehind/lookahead assertions

**For regex extraction in variables**, capture groups concatenate with `-` separator when multiple groups match.

### Time-based condition syntax

```pcl
# Recurring weekly schedule
now in Mon,Tue,Wed,Thu,Fri 09:00:00 to 17:00:00 America/New_York

# Weekend schedule
now in Sat,Sun 00:00:00 to 23:59:59 UTC

# Combined with other conditions
event.severity matches 'critical' and now in Mon,Tue,Wed,Thu,Fri 08:00:00 to 18:00:00 America/Chicago

# Negated (outside business hours)
not (now in Mon,Tue,Wed,Thu,Fri 09:00:00 to 17:00:00 America/New_York)
```

**Format**: `now in <days> <start_time> to <end_time> <timezone>`
- Days: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun` (comma-separated)
- Time: `HH:MM:SS` (24-hour format)
- Timezone: IANA identifiers (`America/New_York`, `Europe/London`, `UTC`)

---

## Global vs Service Orchestration have distinct capabilities and processing order

### Event processing pipeline architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Incoming Event via Integration Key]                               │
│           │                                                         │
│           ▼                                                         │
│  ┌────────────────────────────────────┐                            │
│  │  GLOBAL ORCHESTRATION RULES        │  (AIOps Required)          │
│  │  • Pre-routing enrichment/actions  │                            │
│  │  • Can DROP events completely      │                            │
│  │  • Rules in "sets" (start→nested)  │                            │
│  └────────────────┬───────────────────┘                            │
│                   ▼                                                 │
│  ┌────────────────────────────────────┐                            │
│  │  DYNAMIC ROUTING RULES             │  (Evaluated first)         │
│  │  • Route by Service Name/ID        │                            │
│  │  • No conditions - all events      │                            │
│  └────────────────┬───────────────────┘                            │
│                   ▼                                                 │
│  ┌────────────────────────────────────┐                            │
│  │  STATIC ROUTING RULES              │                            │
│  │  • Condition-based routing         │                            │
│  │  • One rule per destination service│                            │
│  └────────────────┬───────────────────┘                            │
│                   ▼                                                 │
│  ┌────────────────────────────────────┐                            │
│  │  CATCH-ALL RULE                    │                            │
│  │  • Default: suppress unrouted      │                            │
│  │  • Optional: route to fallback svc │                            │
│  └────────────────┬───────────────────┘                            │
│                   ▼                                                 │
│  ┌────────────────────────────────────┐                            │
│  │  SERVICE ORCHESTRATION RULES       │  (All Plans)               │
│  │  • Post-routing final processing   │                            │
│  │  • Can override Global actions     │                            │
│  │  • Automation Actions available    │                            │
│  └────────────────┬───────────────────┘                            │
│                   ▼                                                 │
│  [Alert/Incident Created on Service]                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Rule evaluation order

1. Rules within a set evaluate **top-to-bottom** (highest ordinal first)
2. **First-match behavior** for routing: event routes to first matching rule's destination
3. **Last-evaluated-wins** for discrete actions (priority, severity, escalation policy)
4. **Additive behavior** for webhooks: all matching rules fire their automations
5. `route_to` can point to another "set" ID for nested rule processing

### Capability comparison between orchestration types

| Feature | Global Orchestration | Service Orchestration |
|---------|---------------------|----------------------|
| **Drop Event action** | ✅ Available | ❌ Not available |
| **Automation Actions (Runbook)** | ❌ Not available | ✅ Available |
| **Routes to services** | Via Router | N/A (already routed) |
| **Plan requirement** | AIOps add-on | All plans (basic features) |
| **Scope** | All events before routing | Events on specific service |
| **Can override Global actions** | N/A | ✅ Yes |

### When to use each orchestration type

**Use Global Orchestration for**:
- Organization-wide event normalization
- Dropping test/debug events before they reach any service
- Dynamic routing based on event content
- Central triage policies (suppress known false positives globally)
- Setting escalation policies based on event content across all services

**Use Service Orchestration for**:
- Service-specific logic that shouldn't affect other teams
- Running Runbook Automation Actions (Global cannot)
- Overriding Global Orchestration decisions for specific services
- Team-specific customizations

---

## All orchestration actions documented with configuration syntax

### Routing actions

**Static route to service:**
```hcl
actions {
  route_to = "SERVICE_ID"  # or set ID for nested rules
}
```

**Dynamic routing (AIOps required):**
```hcl
actions {
  dynamic_route_to {
    lookup_by = "service_id"     # or "service_name"
    source    = "event.custom_details.pd_service_id"
    regex     = "(.*)"           # RE2 pattern to extract value
  }
}
```

**Catch-all routing:**
```hcl
catch_all {
  actions {
    route_to = "SERVICE_ID"  # or "unrouted" for suppression
  }
}
```

### Event modification and enrichment actions

**Set severity** (available on all plans):
```hcl
actions {
  severity = "critical"  # info, warning, error, critical
}
```

**Add incident note:**
```hcl
actions {
  annotate = "This incident requires P1 runbook. Contact DBA on-call."
}
```

**Rule variables for data extraction:**
```hcl
actions {
  variable {
    name  = "hostname"
    path  = "event.source"
    type  = "regex"
    value = "^([^.]+)"  # Capture group extracts hostname
  }
}
```

**Field extractions for modification:**
```hcl
# Template-based extraction
actions {
  extraction {
    target   = "event.summary"
    template = "[{{variables.hostname}}] {{event.summary}}"
  }
}

# Regex-based extraction
actions {
  extraction {
    target = "event.custom_details.server"
    source = "event.source"
    regex  = "^([^.]+)"
  }
}
```

**Set custom dedup_key:**
```hcl
actions {
  extraction {
    target   = "dedup_key"
    template = "{{variables.server}}-{{variables.issue_type}}"
  }
}
```

### Suppression and suspend actions (AIOps required)

**Suppress alert** (creates alert, no incident or notifications):
```hcl
actions {
  suppress = true
}
```

**Suspend/pause alert** (delays triggering for self-healing window):
```hcl
actions {
  suspend = 600  # Seconds to wait before triggering incident
}
```

Suspended alerts can be auto-resolved if a resolve event arrives before the timer expires—useful for transient issues that self-heal.

### Automation and webhook actions

**Webhook automation action:**
```hcl
actions {
  automation_action {
    name      = "Diagnostic Webhook"
    url       = "https://automation.example.com/diagnose"
    auto_send = true
    
    header {
      key   = "Authorization"
      value = "Bearer {{cache_var.api_token}}"
    }
    
    parameter {
      key   = "host"
      value = "{{event.source}}"
    }
    
    parameter {
      key   = "alert_id"
      value = "{{event.dedup_key}}"
    }
  }
}
```

**PagerDuty Automation Action** (Service Orchestration only, requires Automation add-on):
```hcl
actions {
  pagerduty_automation_action {
    action_id = "01FJV5A8OA5MKHOYFHV35SM2Z0"
  }
}
```

### Priority and escalation actions

**Set incident priority:**
```hcl
actions {
  priority = data.pagerduty_priority.p1.id  # Priority ID
}
```

**Override escalation policy** (AIOps required):
```hcl
actions {
  escalation_policy = data.pagerduty_escalation_policy.dba.id
}
```

### Drop event action (Global Orchestration only, AIOps required)

```hcl
actions {
  drop_event = true  # Event completely discarded, no record
}
```

### Set incident custom fields

```hcl
actions {
  incident_custom_field_update {
    id    = "FIELD_ID"
    value = "{{event.component}}"  # Dynamic from event
  }
  
  incident_custom_field_update {
    id    = "ANOTHER_FIELD_ID"
    value = "Production"  # Static value
  }
}
```

---

## Advanced features require AIOps and enable stateful event processing

### Cache variables store state across events

Cache Variables store event information that persists across multiple events, enabling stateful logic like counting, rate limiting, and tracking state. Unlike Rule Variables (scoped to single rule), cache variables are accessible throughout the entire orchestration.

**Variable types:**

| Type | Description | Use Case |
|------|-------------|----------|
| **recent_value** | Stores CEF field value | Track last hostname, error code |
| **trigger_event_count** | Counts matching events | Spike detection, rate limiting |
| **external_data** | API/manual input | Maintenance windows, feature flags |

**Terraform example for event counting (spike detection):**
```hcl
resource "pagerduty_event_orchestration_global_cache_variable" "event_spike" {
  event_orchestration = pagerduty_event_orchestration.main.id
  name                = "db_event_count"
  
  condition {
    expression = "event.summary matches part 'database'"
  }
  
  configuration {
    type        = "trigger_event_count"
    ttl_seconds = 300  # Count over 5-minute window
  }
}
```

**Using cache variable in rule condition:**
```pcl
cache_var.db_event_count > 50
```

**External data variable for maintenance windows:**
```hcl
resource "pagerduty_event_orchestration_service_cache_variable" "maintenance" {
  service = pagerduty_service.example.id
  name    = "maintenance_mode"
  
  configuration {
    type        = "external_data"
    data_type   = "boolean"
    ttl_seconds = 14400  # 4 hours
  }
}
```

Set via API: `PUT /event_orchestrations/{id}/cache_variables/{var_id}/data`

**Cache variable limits:**
- Maximum **100 cache variables per orchestration**
- String values truncate at **1024 characters**
- Event count maximum: **1000**
- TTL maximum: **86,400 seconds (24 hours)** for event count, **259,200 seconds (72 hours)** for external data

### Threshold conditions enable spike detection

Threshold-based rules control behavior during alert storms by triggering actions at specific event counts.

**Implementation pattern:**

1. Create event count cache variable with time window
2. Create rule with threshold condition
3. Apply suppression or alternative actions when threshold exceeded

```hcl
# Step 1: Create counter
resource "pagerduty_event_orchestration_global_cache_variable" "spike_counter" {
  name = "spike_counter"
  condition {
    expression = "event.severity matches 'critical'"
  }
  configuration {
    type        = "trigger_event_count"
    ttl_seconds = 300  # 5-minute window
  }
}

# Step 2: Create threshold rule
rule {
  label = "Suppress during spike"
  condition {
    expression = "cache_var.spike_counter > 50"
  }
  actions {
    suppress = true
    annotate = "Suppressed during alert spike (>50 events/5min)"
  }
}
```

**Critical limitation**: Threshold conditions **must stand alone**—they cannot be combined with other condition types in the same rule using AND/OR.

### Dynamic routing and escalation based on event content

**Dynamic service routing** routes events based on service name or ID in the payload:

```hcl
resource "pagerduty_event_orchestration_router" "router" {
  event_orchestration = pagerduty_event_orchestration.main.id
  
  set {
    id = "start"
    
    rule {
      label = "Dynamic route by service name"
      actions {
        dynamic_route_to {
          lookup_by = "service_name"
          source    = "event.custom_details.target_service"
          regex     = "(.*)"
        }
      }
    }
  }
}
```

**Dynamic escalation policy** routes incidents to different teams based on event content:

```hcl
rule {
  label = "Database issues to DBA team"
  condition {
    expression = "event.summary matches part 'database' and event.severity matches 'critical'"
  }
  actions {
    escalation_policy = pagerduty_escalation_policy.dba_oncall.id
    priority          = data.pagerduty_priority.p1.id
  }
}

rule {
  label = "Network issues to NetOps"
  condition {
    expression = "event.component matches 'network' or event.class matches 'connectivity'"
  }
  actions {
    escalation_policy = pagerduty_escalation_policy.netops.id
  }
}
```

---

## AIOps add-on gates most advanced functionality

### Feature availability by plan tier

| Feature | Free/Professional | Business | AIOps Required |
|---------|-------------------|----------|----------------|
| Service Orchestrations (basic) | ✅ | ✅ | — |
| Basic routing rules | ✅ | ✅ | — |
| Priority/severity setting | ✅ | ✅ | — |
| Incident notes | ✅ | ✅ | — |
| **Global Orchestration** | ❌ | ❌ | ✅ |
| **Cache Variables** | ❌ | ❌ | ✅ |
| **Threshold Conditions** | ❌ | ❌ | ✅ |
| **Scheduled/Time-based Rules** | ❌ | ❌ | ✅ |
| **Dynamic Service Routing** | ❌ | ❌ | ✅ |
| **Dynamic Escalation Policy** | ❌ | ❌ | ✅ |
| **Webhooks in Orchestration** | ❌ | ❌ | ✅ |
| **Drop Event action** | ❌ | ❌ | ✅ |
| **Pause/Suspend Notifications** | ❌ | ❌ | ✅ |
| **Rule Nesting (>25 rules)** | ❌ | Limited | ✅ |
| **Event throughput** | 120/min | 120/min | 10,000/min |

### AIOps pricing structure

AIOps uses **consumption-based pricing** per accepted event:
- **Starting price**: $699/month (annual) or $799/month (monthly)
- **Minimum tier**: 96,000 events/month typical starting point
- **Requires**: At least one Professional or Business user license
- **Typical cost impact**: ~17% increase over base Business plan for 100 users

When AIOps is disabled:
- Global Orchestration rules are **skipped during ingestion**
- Cache variables evaluate as **NULL**
- Scheduled/threshold rules are **skipped**
- Event throughput reverts to **120 events/min**

---

## Complete Terraform configuration example

```hcl
# Base orchestration container
resource "pagerduty_event_orchestration" "main" {
  name        = "Production Monitoring"
  description = "Central event processing for production services"
  team        = pagerduty_team.sre.id
}

# Global orchestration rules (requires AIOps)
resource "pagerduty_event_orchestration_global" "global" {
  event_orchestration = pagerduty_event_orchestration.main.id

  set {
    id = "start"
    
    rule {
      label = "Drop test events"
      condition {
        expression = "event.summary matches part '[TEST]' or event.source matches regex 'test-.*'"
      }
      actions {
        drop_event = true
      }
    }
    
    rule {
      label = "Enrich all production events"
      condition {
        expression = "event.source matches regex 'prod-.*'"
      }
      actions {
        variable {
          name  = "hostname"
          path  = "event.source"
          type  = "regex"
          value = "^prod-([^.]+)"
        }
        
        extraction {
          target   = "event.summary"
          template = "[PROD:{{variables.hostname}}] {{event.summary}}"
        }
        
        route_to = "priority-check"
      }
    }
  }

  set {
    id = "priority-check"
    
    rule {
      label = "P1 for critical database alerts"
      condition {
        expression = "event.component matches 'database' and event.severity matches 'critical'"
      }
      actions {
        priority          = data.pagerduty_priority.p1.id
        escalation_policy = pagerduty_escalation_policy.dba.id
        annotate          = "Critical database incident - follow P1 runbook"
      }
    }
  }

  catch_all {
    actions {
      suppress = false
    }
  }
}

# Router for service routing
resource "pagerduty_event_orchestration_router" "router" {
  event_orchestration = pagerduty_event_orchestration.main.id

  set {
    id = "start"
    
    rule {
      label = "Dynamic routing"
      actions {
        dynamic_route_to {
          lookup_by = "service_name"
          source    = "event.custom_details.target_service"
          regex     = "(.*)"
        }
      }
    }
    
    rule {
      label = "Database events"
      condition {
        expression = "event.component matches 'database' or event.component matches 'mysql'"
      }
      actions {
        route_to = pagerduty_service.database.id
      }
    }
    
    rule {
      label = "Web events"
      condition {
        expression = "event.component matches 'web' or event.component matches 'api'"
      }
      actions {
        route_to = pagerduty_service.web.id
      }
    }
  }

  catch_all {
    actions {
      route_to = pagerduty_service.default.id
    }
  }
}

# Service orchestration
resource "pagerduty_event_orchestration_service" "database" {
  service                                = pagerduty_service.database.id
  enable_event_orchestration_for_service = true

  set {
    id = "start"
    
    rule {
      label = "Auto-diagnose on critical"
      condition {
        expression = "event.severity matches 'critical'"
      }
      actions {
        automation_action {
          name      = "DB Health Check"
          url       = "https://automation.example.com/db-diagnose"
          auto_send = true
          
          parameter {
            key   = "host"
            value = "{{event.source}}"
          }
        }
      }
    }
    
    rule {
      label = "Suppress info during off-hours"
      condition {
        expression = "event.severity matches 'info' and not (now in Mon,Tue,Wed,Thu,Fri 09:00:00 to 17:00:00 America/New_York)"
      }
      actions {
        suppress = true
      }
    }
  }

  catch_all {
    actions {
      suppress = false
    }
  }
}

# Cache variable for spike detection
resource "pagerduty_event_orchestration_global_cache_variable" "spike_counter" {
  event_orchestration = pagerduty_event_orchestration.main.id
  name                = "critical_event_count"
  
  condition {
    expression = "event.severity matches 'critical'"
  }
  
  configuration {
    type        = "trigger_event_count"
    ttl_seconds = 300
  }
}
```

---

## System limits and operational constraints

| Resource | Limit |
|----------|-------|
| Services per orchestration | 1,000 |
| Integrations per orchestration | 10 |
| Rules per set | 25 (use nesting for more) |
| Condition blocks per rule | 25 |
| Operators per condition block | 64 |
| Bytes per condition block (PCL) | 2,048 |
| Cache variables per orchestration | 100 |
| Cache variable string length | 1,024 characters |
| Event count max value | 1,000 |
| Event count TTL max | 86,400 seconds (24 hours) |
| External data TTL max | 259,200 seconds (72 hours) |
| API payload max size | 4 MB |
| Event throughput (standard) | 120 events/min per key |
| Event throughput (AIOps) | 10,000 events/min per key |

## Conclusion

PagerDuty Event Orchestration provides a powerful, hierarchical event processing system suitable for enterprise-scale incident management. **PCL enables sophisticated conditional logic** with regex support, nested boolean expressions, and time-based conditions. The **three-tier architecture** (Global → Router → Service) allows both centralized policy enforcement and team-specific customization. For building a similar system, the key architectural insights are: (1) separation of routing from processing logic, (2) cache variables for stateful decision-making across events, (3) threshold-based conditions for noise management, and (4) webhook actions for external system integration. The **AIOps requirement for advanced features** represents a significant cost consideration—organizations should evaluate whether cache variables, dynamic routing, and threshold conditions justify the ~$8,400/year minimum additional spend.