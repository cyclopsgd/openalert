# 🎯 OpenAlert Alert Simulator - Setup Guide

This simulator sends realistic test alerts to OpenAlert throughout the day to test your incident management workflow.

## Quick Start

### Step 1: Create a Test Service in OpenAlert

1. **Log in** to OpenAlert: https://openalert-web.fly.dev
2. **Navigate to Services** (or Teams → Create Team first if needed)
3. **Create a new Service**:
   - Name: `Test Service`
   - Description: `Service for testing automated alerts`
4. **Create an Integration** for the service:
   - Type: `Prometheus` (or Grafana, Generic)
   - Name: `Alert Simulator Integration`
   - **Copy the Integration Key** (you'll need this!)

### Step 2: Run the Simulator

```bash
# One-time test (sends a single alert)
node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --once

# Continuous mode (sends alerts every 10 minutes)
node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --interval=10

# Custom interval (every 5 minutes)
node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --interval=5

# Use Grafana format instead of Prometheus
node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --format=grafana
```

### Step 3: Run in Background (Optional)

**On Windows:**
```powershell
# Start in background
Start-Process node -ArgumentList "alert-simulator.js","--url=https://openalert-api.fly.dev","--key=YOUR_KEY" -WindowStyle Hidden

# Or use Windows Task Scheduler for permanent scheduling
```

**On Linux/Mac:**
```bash
# Start in background
nohup node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_KEY \
  >> alert-simulator.log 2>&1 &

# Or create a systemd service (see below)
```

## What the Simulator Sends

The simulator sends **11 different alert scenarios** with varying severities:

| Scenario | Severity | Frequency | Description |
|----------|----------|-----------|-------------|
| High CPU Usage | Critical | 15% | CPU > 90% for 5 minutes |
| Memory Pressure | High | 20% | Available memory < 10% |
| Disk Space Low | High | 10% | Disk usage > 85% |
| API Latency High | High | 15% | P95 latency > 2 seconds |
| Error Rate Spike | Critical | 10% | 5xx errors increased 500% |
| DB Connection Pool | High | 8% | All connections in use |
| SSL Expiring | Medium | 5% | Certificate expires in 7 days |
| Backup Failed | High | 7% | Database backup failed |
| Pod CrashLoop | Critical | 5% | Kubernetes pod restarting |
| Cache Hit Rate Low | Medium | 10% | Redis hit rate < 70% |
| Queue Backlog | Medium | 5% | Message queue depth high |

## Running as a Service (Linux)

Create `/etc/systemd/system/alert-simulator.service`:

```ini
[Unit]
Description=OpenAlert Alert Simulator
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/openalert
ExecStart=/usr/bin/node alert-simulator.js \
  --url=https://openalert-api.fly.dev \
  --key=YOUR_INTEGRATION_KEY \
  --interval=10
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable alert-simulator
sudo systemctl start alert-simulator
sudo systemctl status alert-simulator
```

## Environment Variables

You can also use environment variables instead of command-line args:

```bash
export OPENALERT_URL=https://openalert-api.fly.dev
export INTEGRATION_KEY=your_integration_key_here
node alert-simulator.js
```

## Troubleshooting

### "Integration key is required"
Make sure you're passing the key correctly:
```bash
node alert-simulator.js --key=YOUR_KEY
```

### "Connection refused" or timeout errors
- Check if the API is accessible: `curl https://openalert-api.fly.dev/health`
- Verify your integration key is correct
- Check your firewall/network settings

### No alerts appearing in OpenAlert
1. Verify the integration exists in OpenAlert
2. Check the integration key matches exactly
3. Look at the webhook logs in OpenAlert (Integrations → View Logs)
4. Check the service has an escalation policy assigned

## Testing the Full Workflow

To test the complete incident management flow:

1. **Create an Escalation Policy**:
   - Go to Escalation Policies
   - Create a new policy
   - Add yourself as a target

2. **Assign Policy to Service**:
   - Edit your Test Service
   - Assign the escalation policy

3. **Run the simulator**:
   ```bash
   node alert-simulator.js --key=YOUR_KEY --once
   ```

4. **Watch for**:
   - Alert appears in Alerts page
   - Incident is created
   - You receive a notification (if configured)
   - Escalation triggers if not acknowledged

## Advanced Usage

### Customize Alert Frequency

Edit `alert-simulator.js` and modify the `frequency` values in `alertScenarios`. The frequencies must sum to approximately 1.0.

### Add Custom Scenarios

Add new scenarios to the `alertScenarios` array:

```javascript
{
  name: 'my_custom_alert',
  severity: 'high',
  frequency: 0.10, // 10% chance
  title: 'My Custom Alert',
  description: 'Something went wrong',
  labels: { service: 'my-service', alertname: 'CustomAlert' },
  annotations: { summary: 'Details here' },
}
```

## Stop the Simulator

- **Foreground**: Press `Ctrl+C`
- **Background process**: `pkill -f alert-simulator`
- **Systemd service**: `sudo systemctl stop alert-simulator`

## Support

For issues or questions:
- Check OpenAlert logs: `fly logs -a openalert-api`
- View webhook logs in the UI
- Check simulator output for error messages
