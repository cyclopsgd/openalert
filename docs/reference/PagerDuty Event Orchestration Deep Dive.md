# Webhook payload specifications for monitoring platforms

Building webhook receivers for monitoring systems requires understanding the exact JSON structures, authentication mechanisms, and behavioral differences between firing and resolved alerts. This reference documents the complete technical specifications for **Azure Monitor**, **Zabbix**, **Prometheus Alertmanager**, and **Grafana Alerting**—the four most widely deployed alerting platforms.

All four platforms use HTTP POST with `Content-Type: application/json`, but differ significantly in payload structure: Azure and Grafana Unified Alerting use nested schemas with standardized `essentials`/`alerts` arrays, while Zabbix uses JavaScript-constructed payloads via macros, and Prometheus Alertmanager groups alerts by label sets.

---

## Azure Monitor Common Alert Schema

Azure Monitor's Common Alert Schema standardizes all alert types through Action Groups webhooks, using `schemaId: "azureMonitorCommonAlertSchema"` to identify the payload format.

### Core payload structure

```json
{
  "schemaId": "azureMonitorCommonAlertSchema",
  "data": {
    "essentials": {
      "alertId": "/subscriptions/{subscription-id}/providers/Microsoft.AlertsManagement/alerts/{alert-id}",
      "alertRule": "High CPU Alert",
      "severity": "Sev2",
      "signalType": "Metric",
      "monitorCondition": "Fired",
      "monitoringService": "Platform",
      "alertTargetIDs": ["/subscriptions/{id}/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"],
      "configurationItems": ["vm1"],
      "originAlertId": "3f2d4487-b0fc-4125-8bd5-7ad17384221e",
      "firedDateTime": "2025-01-15T13:58:24.3713213Z",
      "resolvedDateTime": "2025-01-15T14:03:16.2246313Z",
      "description": "Alert description",
      "essentialsVersion": "1.0",
      "alertContextVersion": "1.0"
    },
    "alertContext": { /* varies by alert type */ },
    "customProperties": { "key1": "value1" }
  }
}
```

### Essential fields reference

| Field | Type | Description |
|-------|------|-------------|
| `alertId` | string | Azure Resource Manager ID for the alert instance |
| `severity` | enum | `Sev0` (critical) through `Sev4` (verbose) |
| `signalType` | enum | `Metric`, `Log`, or `Activity Log` |
| `monitorCondition` | enum | `Fired` or `Resolved` |
| `monitoringService` | string | Service identifier (see table below) |
| `alertTargetIDs` | string[] | ARM IDs of affected resources |
| `firedDateTime` | ISO 8601 | When alert triggered |
| `resolvedDateTime` | ISO 8601 | Present only when `monitorCondition` is `Resolved` |

### The monitoringService values map to specific alert types

| Alert Type | monitoringService Value |
|------------|-------------------------|
| Metric alerts | `Platform` |
| Log search alerts (V2) | `Log Alerts V2` |
| Activity Log - Administrative | `Activity Log - Administrative` |
| Service Health | `ServiceHealth` |
| Resource Health | `Resource Health` |

### Metric alert context structure

For static threshold metric alerts, the `alertContext` contains:

```json
{
  "alertContext": {
    "conditionType": "SingleResourceMultipleMetricCriteria",
    "condition": {
      "windowSize": "PT5M",
      "allOf": [{
        "metricName": "Percentage CPU",
        "metricNamespace": "Microsoft.Compute/virtualMachines",
        "operator": "GreaterThan",
        "threshold": "80",
        "timeAggregation": "Average",
        "dimensions": [{"name": "ResourceId", "value": "vm-guid"}],
        "metricValue": 92.5
      }],
      "windowStartTime": "2025-01-15T13:40:03.064Z",
      "windowEndTime": "2025-01-15T13:45:03.064Z"
    }
  }
}
```

Dynamic threshold alerts add `alertSensitivity` (High/Medium/Low) and `failingPeriods` configuration. Log alerts include `searchQuery`, `linkToSearchResultsUI`, and optionally embedded `SearchResults` when payload size permits.

### Service Health alerts include incident details

```json
{
  "alertContext": {
    "properties": {
      "title": "Azure Synapse Analytics Scheduled Maintenance",
      "service": "Azure Synapse Analytics",
      "region": "East US",
      "incidentType": "Maintenance",
      "impactStartTime": "2025-01-26T04:00:00Z",
      "impactMitigationTime": "2025-01-26T12:00:00Z",
      "communication": "<detailed message>"
    }
  }
}
```

The `incidentType` field values are: `Incident` (service issue), `Maintenance` (planned), `Informational` (advisory), and `ActionRequired` (security).

### Authentication and webhook configuration

**Standard webhooks** support token-based authorization via URI query parameters only (e.g., `?tokenid=secret`). **Secure webhooks** use Microsoft Entra ID OAuth2 with the AZNS AAD Webhook service principal (AppId: `461e8683-5575-4561-ac7f-899cc907d62a`).

### Rate limits and constraints

| Constraint | Limit |
|------------|-------|
| Webhook calls per subscription | **1,500/minute** |
| Webhook actions per action group | 10 |
| Payload size (common schema) | **256 KB** |
| Retry attempts | 5 (delays: 5s, 20s, 5s, 40s, 5s) |
| Retryable status codes | 408, 429, 503, 504 |

---

## Zabbix webhook media type

Zabbix webhooks differ fundamentally from other platforms—they don't send a predefined payload. Instead, **parameters with macros are passed to JavaScript**, which constructs and sends the HTTP request.

### Webhook parameters become JavaScript input

Parameters are configured as name-value pairs with macro substitution, then passed to a JavaScript function as a JSON string in the `value` variable:

```javascript
try {
    var params = JSON.parse(value),
        req = new HttpRequest();
    
    req.addHeader('Content-Type: application/json');
    req.addHeader('Authorization: Bearer ' + params.token);
    
    var payload = {
        "event_action": params.event_value === '1' ? 'trigger' : 'resolve',
        "event_id": params.event_id,
        "host": params.host_name,
        "severity": params.event_severity,
        "title": params.subject,
        "description": params.message
    };
    
    var response = req.post(params.URL, JSON.stringify(payload));
    if (req.getStatus() !== 200) throw 'HTTP ' + req.getStatus();
    
    return 'OK';
} catch (error) {
    Zabbix.log(3, 'Webhook failed: ' + error);
    throw error;
}
```

### Complete macro reference for common use cases

**Host macros:**
| Macro | Description |
|-------|-------------|
| `{HOST.NAME}` | Visible host name |
| `{HOST.IP}` | Host IP address |
| `{HOST.DNS}` | Host DNS name |
| `{HOST.CONN}` | Connection address (IP or DNS based on config) |

**Trigger macros:**
| Macro | Description |
|-------|-------------|
| `{TRIGGER.NAME}` | Trigger name (macros resolved) |
| `{TRIGGER.STATUS}` | Current status: `PROBLEM` or `OK` |
| `{TRIGGER.SEVERITY}` | Severity name |
| `{TRIGGER.NSEVERITY}` | Numeric severity (0-5) |
| `{TRIGGER.ID}` | Unique trigger ID |

**Event macros (critical for webhook logic):**
| Macro | Description |
|-------|-------------|
| `{EVENT.ID}` | Unique event identifier |
| `{EVENT.VALUE}` | **1** = Problem, **0** = Resolved |
| `{EVENT.SEVERITY}` | Event severity name |
| `{EVENT.NSEVERITY}` | Numeric severity (0-5) |
| `{EVENT.DATE}` | Event date (YYYY.MM.DD) |
| `{EVENT.TIME}` | Event time (HH:MM:SS) |
| `{EVENT.TAGS}` | Comma-separated tag list |
| `{EVENT.TAGSJSON}` | Tags as JSON array |

**Recovery-specific macros:**
| Macro | Description |
|-------|-------------|
| `{EVENT.RECOVERY.ID}` | Recovery event ID |
| `{EVENT.RECOVERY.DATE}` | Recovery date |
| `{EVENT.RECOVERY.TIME}` | Recovery time |

### Problem vs recovery event handling

The **`{EVENT.VALUE}` macro is the key differentiator**: value `1` indicates a problem, value `0` indicates resolution. Webhook scripts should branch on this:

```javascript
if (params.event_value === '1') {
    payload.action = 'trigger';
} else {
    payload.action = 'resolve';
    payload.resolved_at = params.event_recovery_time;
}
```

### Authentication options in Zabbix webhooks

```javascript
// Basic auth
req.setHttpAuth(HTTPAUTH_BASIC, params.username, params.password);

// Bearer token
req.addHeader('Authorization: Bearer ' + params.token);

// API key header
req.addHeader('X-API-Key: ' + params.api_key);

// HMAC signature
var signature = hmac('sha256', params.secret_key, JSON.stringify(payload));
req.addHeader('X-Signature: ' + signature);
```

### Constraints and limits

| Setting | Range/Default |
|---------|---------------|
| Timeout | 1-60 seconds (default 30s) |
| Max concurrent sessions | 0-100 (0 = unlimited) |
| Max retry attempts | 1-100 (default 3) |
| HttpRequest objects per script | Maximum 10 |
| HTTP header size | 128 KB total |

---

## Prometheus Alertmanager webhook receiver

Alertmanager sends grouped alerts to webhook receivers via HTTP POST with a well-defined JSON structure.

### webhook_config in alertmanager.yml

```yaml
receivers:
  - name: 'webhook-receiver'
    webhook_configs:
      - url: 'https://api.example.com/alerts'
        send_resolved: true
        max_alerts: 100
        timeout: 10s
        http_config:
          authorization:
            type: Bearer
            credentials: 'your-api-token'
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | secret | required | Endpoint for POST requests |
| `send_resolved` | boolean | `true` | Whether to notify on resolution |
| `max_alerts` | int | `0` | Maximum alerts (0 = unlimited) |
| `timeout` | duration | `0s` | Request timeout |

### Complete webhook payload structure

```json
{
  "version": "4",
  "groupKey": "{}:{alertname=\"HighCPU\", cluster=\"prod\"}",
  "truncatedAlerts": 0,
  "status": "firing",
  "receiver": "webhook-receiver",
  "groupLabels": {
    "alertname": "HighCPU",
    "cluster": "prod"
  },
  "commonLabels": {
    "alertname": "HighCPU",
    "severity": "critical",
    "job": "node-exporter"
  },
  "commonAnnotations": {
    "runbook_url": "https://runbooks.example.com/cpu"
  },
  "externalURL": "http://alertmanager:9093",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighCPU",
        "severity": "critical",
        "instance": "server01:9100",
        "job": "node-exporter",
        "cluster": "prod"
      },
      "annotations": {
        "summary": "High CPU usage on server01",
        "description": "CPU above 90% for 5 minutes"
      },
      "startsAt": "2025-01-15T10:30:00.000Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "http://prometheus:9090/graph?g0.expr=...",
      "fingerprint": "a1b2c3d4e5f67890"
    }
  ]
}
```

### Alert object field reference

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `firing` or `resolved` |
| `labels` | map[string]string | All labels including `alertname` |
| `annotations` | map[string]string | Summary, description, runbook_url, etc. |
| `startsAt` | RFC3339 | When alert started firing |
| `endsAt` | RFC3339 | Resolution time; `0001-01-01T00:00:00Z` if still firing |
| `generatorURL` | string | Link back to Prometheus expression |
| `fingerprint` | string | Unique identifier based on label hash |

### Understanding grouping fields

**`groupLabels`** contains only the labels specified in `group_by` configuration. **`commonLabels`** contains labels identical across ALL alerts in the group—if any label differs between alerts, it won't appear here. The same logic applies to **`commonAnnotations`**.

The **`groupKey`** format is: `{<route_matcher>}:{<group_label>=<value>, ...}`

### Firing vs resolved behavior

The top-level `status` is `"firing"` if **any** alert in the group is firing. A payload can contain both firing and resolved alerts simultaneously—each alert has its own `status`. The group only becomes `"resolved"` when all alerts resolve.

For **firing alerts**, `endsAt` is set to `"0001-01-01T00:00:00Z"` (the Go zero time). For **resolved alerts**, `endsAt` contains the actual resolution timestamp.

### Authentication via http_config

```yaml
http_config:
  # Basic auth
  basic_auth:
    username: 'admin'
    password: 'secret'
  
  # Or bearer token
  authorization:
    type: Bearer
    credentials: 'token-value'
  
  # Or OAuth2
  oauth2:
    client_id: 'client-id'
    client_secret: 'secret'
    token_url: 'https://auth.example.com/token'
  
  # TLS settings
  tls_config:
    ca_file: '/path/to/ca.crt'
    cert_file: '/path/to/client.crt'
    key_file: '/path/to/client.key'
```

### Rate limiting via timing configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `group_wait` | 30s | Delay before first notification for new group |
| `group_interval` | 5m | Interval between notifications for existing group |
| `repeat_interval` | 4h | Time before re-sending unchanged notification |

Webhooks return **5xx** for retryable errors and **4xx** for permanent failures (not retried).

---

## Grafana Alerting webhook contact point

Grafana has two distinct alerting systems with different payloads: **Legacy Alerting** (pre-Grafana 8, removed in Grafana 11) and **Unified Alerting** (Grafana 8+).

### Legacy alerting payload (pre-Grafana 8)

```json
{
  "title": "[Alerting] High CPU Alert",
  "ruleId": 1,
  "ruleName": "High CPU Alert",
  "state": "alerting",
  "evalMatches": [
    {
      "value": 92.5,
      "metric": "cpu_usage_percent",
      "tags": {"host": "server01", "region": "us-west"}
    }
  ],
  "orgId": 1,
  "dashboardId": 15,
  "panelId": 3,
  "tags": {"severity": "critical"},
  "ruleUrl": "http://grafana:3000/d/abc123/dashboard?panelId=3",
  "imageUrl": "https://storage.example.com/screenshots/alert1.png",
  "message": "CPU usage exceeded threshold"
}
```

Legacy states: `alerting`, `ok`, `no_data`, `paused`, `pending`

### Unified Alerting payload (Grafana 8+)

```json
{
  "receiver": "webhook-receiver",
  "status": "firing",
  "orgId": 1,
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighMemoryUsage",
        "severity": "warning",
        "instance": "server01"
      },
      "annotations": {
        "summary": "Memory usage is high",
        "description": "Memory usage exceeded 85%",
        "runbook_url": "https://runbooks.example.com/memory"
      },
      "startsAt": "2025-01-15T10:30:00.000Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://grafana.example.com/alerting/abc123/edit",
      "fingerprint": "c6eadffa33fcdf37",
      "silenceURL": "https://grafana.example.com/alerting/silence/new?...",
      "dashboardURL": "https://grafana.example.com/d/xyz789/dashboard",
      "panelURL": "https://grafana.example.com/d/xyz789/dashboard?viewPanel=2",
      "values": {
        "A": 87.5,
        "B": 1
      },
      "valueString": "[ var='A' labels={instance=server01} value=87.5 ]",
      "imageURL": "https://storage.example.com/screenshots/alert123.png"
    }
  ],
  "groupLabels": {"alertname": "HighMemoryUsage"},
  "commonLabels": {"severity": "warning"},
  "commonAnnotations": {},
  "externalURL": "https://grafana.example.com",
  "version": "1",
  "groupKey": "{}:{alertname=\"HighMemoryUsage\"}",
  "truncatedAlerts": 0,
  "title": "[FIRING:1] HighMemoryUsage (warning)",
  "state": "alerting",
  "message": "**Firing**\n\nLabels:\n - alertname = HighMemoryUsage..."
}
```

### Unified Alerting alert object fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `firing` or `resolved` |
| `labels` | object | All labels including alertname |
| `annotations` | object | Summary, description, runbook_url |
| `startsAt` | RFC3339 | Alert start time |
| `endsAt` | RFC3339 | Resolution time or zero time if firing |
| `generatorURL` | string | Link to alert rule edit page |
| `fingerprint` | string | Unique identifier |
| `silenceURL` | string | Pre-filled silence creation link |
| `dashboardURL` | string | Associated dashboard (requires annotation) |
| `panelURL` | string | Associated panel (requires annotation) |
| `values` | object | Expression values keyed by refID (e.g., `{"A": 87.5}`) |
| `valueString` | string | Human-readable values representation |
| `imageURL` | string | Screenshot URL (if rendering configured) |

### Image rendering configuration

To include screenshots in webhooks, configure `grafana.ini`:

```ini
[unified_alerting.screenshots]
capture = true
upload_external_image_storage = true

[external_image_storage]
provider = s3

[external_image_storage.s3]
bucket = grafana-screenshots
region = us-east-1
```

Alert rules must have **Dashboard UID** and **Panel ID** annotations. Screenshots are captured once when firing and once when resolved.

### Template variables for custom payloads

```go
{{ define "custom.webhook" }}
{
  "alerts": [
    {{ range .Alerts }}
    {
      "name": "{{ .Labels.alertname }}",
      "status": "{{ .Status }}",
      "value": "{{ .ValueString }}",
      "summary": "{{ .Annotations.summary }}"
    }{{ if not (last .) }},{{ end }}
    {{ end }}
  ],
  "firing_count": {{ .Alerts.Firing | len }},
  "resolved_count": {{ .Alerts.Resolved | len }}
}
{{ end }}
```

### Authentication options

| Method | Configuration |
|--------|---------------|
| Basic Auth | Username + Password fields |
| Authorization Header | Scheme (default: Bearer) + Credentials |
| HMAC Signature | Shared secret + Header name |
| Custom Headers | Any key-value pairs |

**HMAC signature verification**: Grafana calculates `HMAC-SHA256(body, secret)` and sends it in the configured header (default: `X-Grafana-Alerting-Signature`). With timestamp enabled, the signature is `HMAC-SHA256(timestamp + ":" + body, secret)`.

### Timing and rate limits

| Setting | Default | Description |
|---------|---------|-------------|
| Group Wait | 30s | Initial notification delay |
| Group Interval | 5m | Subsequent notification interval |
| Repeat Interval | 4h | Re-notification delay |
| Max Alerts | 0 | Per-notification limit (0 = unlimited) |

---

## Cross-platform comparison for webhook receiver implementation

| Aspect | Azure Monitor | Zabbix | Prometheus | Grafana Unified |
|--------|---------------|--------|------------|-----------------|
| Payload version field | `schemaId` | N/A (custom) | `version: "4"` | `version: "1"` |
| Alert grouping | Single alert per payload | Single alert | Label-based groups | Label-based groups |
| Firing indicator | `monitorCondition: "Fired"` | `{EVENT.VALUE}: "1"` | `status: "firing"` | `status: "firing"` |
| Resolved indicator | `monitorCondition: "Resolved"` | `{EVENT.VALUE}: "0"` | `status: "resolved"` | `status: "resolved"` |
| Metric values | `metricValue` in alertContext | `{ITEM.VALUE}` macro | In labels/annotations | `values` object |
| Signature verification | Entra ID OAuth2 | Custom via script | N/A (use TLS) | HMAC-SHA256 |
| Max payload size | 256 KB | Script-dependent | Configurable | ~1 MB typical |

When implementing a multi-platform webhook receiver, use the presence of specific fields for routing: check for `schemaId` (Azure), `version: "4"` (Prometheus), `version: "1"` with `orgId` (Grafana), or implement platform-specific endpoints.