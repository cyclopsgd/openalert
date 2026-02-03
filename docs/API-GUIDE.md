# OpenAlert API Guide

Complete guide to using the OpenAlert API for incident management, alerting, and on-call scheduling.

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Filtering and Sorting](#filtering-and-sorting)
- [WebSocket Endpoints](#websocket-endpoints)
- [API Endpoints](#api-endpoints)
- [Code Examples](#code-examples)

## Authentication

### Overview

OpenAlert supports two authentication methods:

1. **Azure Entra ID (OAuth 2.0)** - Recommended for production
2. **Local Username/Password** - For self-hosted installations

All authenticated endpoints require a JWT bearer token in the Authorization header.

### Obtaining a Token

#### Option 1: Azure Entra ID (OAuth 2.0)

```bash
# Step 1: Redirect user to Azure AD login
GET https://your-openalert-instance.com/auth/login

# Step 2: User authenticates and is redirected back
# Azure calls: GET https://your-openalert-instance.com/auth/callback?code=...

# Step 3: OpenAlert returns JWT token in response
```

#### Option 2: Local Authentication

```bash
# Login with username and password
POST https://your-openalert-instance.com/auth/local/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "responder"
  }
}
```

#### Option 3: Development Mode Only

```bash
# Get a dev token (only works in development)
GET http://localhost:3001/auth/dev-token/1

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Using the Token

Include the token in the Authorization header for all authenticated requests:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiry

JWT tokens expire after **7 days**. When a token expires, you'll receive a 401 Unauthorized response. Re-authenticate to obtain a new token.

## Rate Limiting

### Default Limits

- **Authenticated Endpoints**: 1000 requests per minute per user
- **Webhook Endpoints**: 100 webhooks per minute per integration key
- **Public Status Pages**: 100 requests per minute per IP

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1706908800
```

### Rate Limit Exceeded

When you exceed the rate limit, you'll receive:

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-02-03T10:30:00.000Z",
  "path": "/incidents",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Request accepted for processing (webhooks) |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Validation Errors

Validation errors include detailed information about what failed:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "email must be a valid email address",
    "password must be at least 8 characters long"
  ]
}
```

## Pagination

### Query Parameters

List endpoints support pagination via query parameters:

```bash
GET /incidents?limit=50&offset=0
```

- `limit` - Number of items to return (default: 50, max: 100)
- `offset` - Number of items to skip (default: 0)

### Response Format

Paginated responses include metadata:

```json
{
  "data": [...],
  "pagination": {
    "total": 250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Pagination Example

```bash
# Get first page
GET /incidents?limit=50&offset=0

# Get second page
GET /incidents?limit=50&offset=50

# Get third page
GET /incidents?limit=50&offset=100
```

## Filtering and Sorting

### Filtering

Most list endpoints support filtering via query parameters:

```bash
# Filter incidents by status
GET /incidents?status=triggered

# Filter by severity
GET /incidents?severity=critical

# Filter by service
GET /incidents?serviceId=5

# Filter by date range
GET /incidents?dateFrom=2024-01-01&dateTo=2024-02-01

# Combine multiple filters
GET /incidents?status=acknowledged&severity=high&serviceId=5
```

### Available Filters

#### Incidents
- `status` - triggered, acknowledged, resolved
- `severity` - critical, high, medium, low, info
- `serviceId` - Filter by service ID
- `assigneeId` - Filter by assigned user ID
- `search` - Full-text search in title/description
- `dateFrom` - Start date (ISO 8601)
- `dateTo` - End date (ISO 8601)

#### Alerts
- `status` - firing, acknowledged, resolved, suppressed
- `incidentId` - Filter by incident ID

### Sorting

Use the `sortBy` parameter to sort results:

```bash
# Sort by creation date (newest first)
GET /incidents?sortBy=createdAt:desc

# Sort by severity (critical first)
GET /incidents?sortBy=severity:desc

# Sort by status
GET /incidents?sortBy=status:asc
```

Available sort fields: `createdAt`, `severity`, `status`, `updatedAt`

## WebSocket Endpoints

### Connection

Connect to the WebSocket server for real-time updates:

```javascript
import io from 'socket.io-client';

const socket = io('https://your-openalert-instance.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Authentication

WebSocket connections must include a JWT token:

```javascript
socket.on('connect', () => {
  console.log('Connected to OpenAlert WebSocket');
});

socket.on('unauthorized', (error) => {
  console.error('Auth error:', error);
});
```

### Subscribing to Rooms

Subscribe to specific rooms to receive targeted updates:

```javascript
// Subscribe to all incidents
socket.emit('join', 'incidents');

// Subscribe to specific incident
socket.emit('join', 'incident:123');

// Subscribe to team updates
socket.emit('join', 'team:5');
```

### Events

#### Incident Events

```javascript
// New incident created
socket.on('incident:created', (incident) => {
  console.log('New incident:', incident);
});

// Incident updated
socket.on('incident:updated', (incident) => {
  console.log('Incident updated:', incident);
});

// Incident acknowledged
socket.on('incident:acknowledged', (incident) => {
  console.log('Incident acknowledged:', incident);
});

// Incident resolved
socket.on('incident:resolved', (incident) => {
  console.log('Incident resolved:', incident);
});
```

#### Alert Events

```javascript
// New alert received
socket.on('alert:created', (alert) => {
  console.log('New alert:', alert);
});

// Alert updated
socket.on('alert:updated', (alert) => {
  console.log('Alert updated:', alert);
});
```

## API Endpoints

### Authentication

#### Login (Azure AD)
```bash
GET /auth/login
```
Redirects to Azure AD login page.

#### Login (Local)
```bash
POST /auth/local/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

#### Get Profile
```bash
GET /auth/profile
Authorization: Bearer {token}
```

### Incidents

#### List Incidents
```bash
GET /incidents?status=triggered&severity=critical&limit=50&offset=0
Authorization: Bearer {token}
```

#### Get Incident by ID
```bash
GET /incidents/{id}
Authorization: Bearer {token}
```

#### Acknowledge Incident
```bash
PATCH /incidents/{id}/acknowledge
Authorization: Bearer {token}
Content-Type: application/json

{
  "note": "Investigating the issue"
}
```

#### Resolve Incident
```bash
PATCH /incidents/{id}/resolve
Authorization: Bearer {token}
Content-Type: application/json

{
  "resolution": "Fixed by restarting the service"
}
```

#### Bulk Acknowledge
```bash
POST /incidents/bulk/acknowledge
Authorization: Bearer {token}
Content-Type: application/json

{
  "incidentIds": [1, 2, 3]
}
```

#### Bulk Resolve
```bash
POST /incidents/bulk/resolve
Authorization: Bearer {token}
Content-Type: application/json

{
  "incidentIds": [1, 2, 3]
}
```

### Alerts

#### List Alerts
```bash
GET /alerts?status=firing&limit=50&offset=0
Authorization: Bearer {token}
```

#### Get Alert by ID
```bash
GET /alerts/{id}
Authorization: Bearer {token}
```

#### Acknowledge Alert
```bash
PATCH /alerts/{id}/acknowledge
Authorization: Bearer {token}
```

#### Resolve Alert
```bash
PATCH /alerts/{id}/resolve
Authorization: Bearer {token}
```

### Schedules

#### Create Schedule
```bash
POST /schedules
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "DevOps On-Call",
  "teamId": 1,
  "timezone": "America/New_York",
  "description": "Primary DevOps on-call schedule"
}
```

#### Get Schedule
```bash
GET /schedules/{id}
Authorization: Bearer {token}
```

#### Get Current On-Call
```bash
GET /schedules/{id}/oncall
Authorization: Bearer {token}
```

#### Add Rotation
```bash
POST /schedules/{id}/rotations
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Week 1",
  "rotationType": "weekly",
  "startDate": "2024-02-05T00:00:00Z",
  "participantIds": [1, 2, 3]
}
```

### Services

#### List Services
```bash
GET /services
Authorization: Bearer {token}
```

#### Create Service
```bash
POST /services
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "API Gateway",
  "slug": "api-gateway",
  "description": "Main API gateway service",
  "teamId": 1,
  "escalationPolicyId": 1
}
```

#### Get Service
```bash
GET /services/{id}
Authorization: Bearer {token}
```

### Teams

#### List Teams
```bash
GET /teams
Authorization: Bearer {token}
```

#### Create Team
```bash
POST /teams
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "DevOps Team",
  "slug": "devops",
  "description": "DevOps and SRE team"
}
```

#### Add Team Member
```bash
POST /teams/{id}/members
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": 5,
  "teamRole": "member"
}
```

### Webhooks (No Auth Required)

#### Generic Webhook
```bash
POST /webhooks/v1/{integrationKey}
Content-Type: application/json

{
  "title": "High CPU Usage",
  "severity": "high",
  "description": "CPU usage exceeds 90%",
  "labels": {
    "host": "web-server-01",
    "metric": "cpu"
  }
}
```

#### Prometheus Webhook
```bash
POST /webhooks/prometheus/{integrationKey}
Content-Type: application/json

{
  "alerts": [...]
}
```

#### Grafana Webhook
```bash
POST /webhooks/grafana/{integrationKey}
Content-Type: application/json

{
  "alerts": [...]
}
```

### Status Pages (No Auth Required)

#### Get Status Page
```bash
GET /public/status/{slug}
```

#### Get Status Page Incidents
```bash
GET /public/status/{slug}/incidents
```

#### Get Status Page Components
```bash
GET /public/status/{slug}/components
```

### Health & Metrics (No Auth Required)

#### Health Check
```bash
GET /health
```

#### Liveness Probe
```bash
GET /health/live
```

#### Readiness Probe
```bash
GET /health/ready
```

#### Prometheus Metrics
```bash
GET /metrics
```

## Code Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_URL = 'https://your-openalert-instance.com';
const API_TOKEN = 'your-jwt-token';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// List incidents
async function listIncidents() {
  const response = await client.get('/incidents', {
    params: {
      status: 'triggered',
      severity: 'critical',
      limit: 50
    }
  });
  return response.data;
}

// Acknowledge incident
async function acknowledgeIncident(id: number) {
  const response = await client.patch(`/incidents/${id}/acknowledge`, {
    note: 'Investigating'
  });
  return response.data;
}

// Send webhook
async function sendAlert() {
  const response = await axios.post(
    `${API_URL}/webhooks/v1/your-integration-key`,
    {
      title: 'High CPU Usage',
      severity: 'high',
      description: 'CPU usage exceeds 90%',
      labels: {
        host: 'web-server-01'
      }
    }
  );
  return response.data;
}
```

### Python

```python
import requests

API_URL = 'https://your-openalert-instance.com'
API_TOKEN = 'your-jwt-token'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

# List incidents
def list_incidents():
    response = requests.get(
        f'{API_URL}/incidents',
        headers=headers,
        params={
            'status': 'triggered',
            'severity': 'critical',
            'limit': 50
        }
    )
    return response.json()

# Acknowledge incident
def acknowledge_incident(incident_id):
    response = requests.patch(
        f'{API_URL}/incidents/{incident_id}/acknowledge',
        headers=headers,
        json={'note': 'Investigating'}
    )
    return response.json()

# Send webhook
def send_alert():
    response = requests.post(
        f'{API_URL}/webhooks/v1/your-integration-key',
        json={
            'title': 'High CPU Usage',
            'severity': 'high',
            'description': 'CPU usage exceeds 90%',
            'labels': {
                'host': 'web-server-01'
            }
        }
    )
    return response.json()
```

### curl

```bash
# Login (local auth)
curl -X POST https://your-openalert-instance.com/auth/local/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# List incidents
curl -X GET https://your-openalert-instance.com/incidents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -G \
  -d "status=triggered" \
  -d "severity=critical" \
  -d "limit=50"

# Acknowledge incident
curl -X PATCH https://your-openalert-instance.com/incidents/123/acknowledge \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Investigating"}'

# Send webhook
curl -X POST https://your-openalert-instance.com/webhooks/v1/your-integration-key \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU Usage",
    "severity": "high",
    "description": "CPU usage exceeds 90%",
    "labels": {
      "host": "web-server-01"
    }
  }'
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

const (
    APIURL   = "https://your-openalert-instance.com"
    APIToken = "your-jwt-token"
)

type Client struct {
    baseURL string
    token   string
    http    *http.Client
}

func NewClient() *Client {
    return &Client{
        baseURL: APIURL,
        token:   APIToken,
        http:    &http.Client{},
    }
}

func (c *Client) ListIncidents() ([]map[string]interface{}, error) {
    req, _ := http.NewRequest("GET", c.baseURL+"/incidents", nil)
    req.Header.Set("Authorization", "Bearer "+c.token)

    q := req.URL.Query()
    q.Add("status", "triggered")
    q.Add("severity", "critical")
    req.URL.RawQuery = q.Encode()

    resp, err := c.http.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result []map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    return result, nil
}

func (c *Client) SendAlert(integrationKey string, alert map[string]interface{}) error {
    body, _ := json.Marshal(alert)
    url := fmt.Sprintf("%s/webhooks/v1/%s", c.baseURL, integrationKey)

    resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}
```

## Interactive API Documentation

OpenAlert provides interactive Swagger/OpenAPI documentation at:

```
https://your-openalert-instance.com/api/docs
```

Use the Swagger UI to:
- Explore all available endpoints
- View request/response schemas
- Test API calls directly in your browser
- Download OpenAPI specification

## Support

For additional help:
- Check the [Integration Guide](INTEGRATION-GUIDE.md) for webhook examples
- Review the [Deployment Guide](DEPLOYMENT.md) for setup instructions
- Visit our [GitHub Issues](https://github.com/yourusername/openalert/issues) for support
