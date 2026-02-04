#!/usr/bin/env node
/**
 * OpenAlert - Automated Alert Testing Simulator
 *
 * Sends realistic test alerts throughout the day to test:
 * - Alert ingestion
 * - Incident creation
 * - Escalation policies
 * - Notifications
 * - Alert grouping
 *
 * Usage:
 *   node alert-simulator.js --url https://openalert-api.fly.dev --key YOUR_INTEGRATION_KEY
 *   node alert-simulator.js --url https://openalert-api.fly.dev --key YOUR_INTEGRATION_KEY --interval 5
 *   node alert-simulator.js --url https://openalert-api.fly.dev --key YOUR_INTEGRATION_KEY --once
 */

const https = require('https');

// Configuration
const config = {
  apiUrl: process.env.OPENALERT_URL || process.argv.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'https://openalert-api.fly.dev',
  integrationKey: process.env.INTEGRATION_KEY || process.argv.find(arg => arg.startsWith('--key='))?.split('=')[1],
  interval: parseInt(process.argv.find(arg => arg.startsWith('--interval='))?.split('=')[1] || '10'), // minutes
  runOnce: process.argv.includes('--once'),
  format: process.argv.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'prometheus', // prometheus, grafana, generic
};

if (!config.integrationKey) {
  console.error('❌ Error: Integration key is required!');
  console.error('Usage: node alert-simulator.js --url=<url> --key=<integration-key>');
  console.error('');
  console.error('Get your integration key from OpenAlert:');
  console.error('  1. Log in to https://openalert-web.fly.dev');
  console.error('  2. Create a Service (e.g., "Test Service")');
  console.error('  3. Create an Integration (e.g., "Prometheus")');
  console.error('  4. Copy the integration key');
  process.exit(1);
}

// Alert scenarios with varying severity and patterns
const alertScenarios = [
  {
    name: 'high_cpu_usage',
    severity: 'critical',
    frequency: 0.15, // 15% chance
    title: 'High CPU Usage Detected',
    description: 'CPU usage has exceeded 90% for more than 5 minutes',
    labels: { instance: 'web-server-01', alertname: 'HighCPU', job: 'node-exporter' },
    annotations: { summary: 'CPU usage at 95%', runbook_url: 'https://runbooks.example.com/cpu' },
  },
  {
    name: 'memory_pressure',
    severity: 'high',
    frequency: 0.20, // 20% chance
    title: 'Memory Pressure Warning',
    description: 'Available memory is below 10%',
    labels: { instance: 'web-server-02', alertname: 'LowMemory', job: 'node-exporter' },
    annotations: { summary: 'Memory usage at 92%', description: 'Consider scaling up' },
  },
  {
    name: 'disk_space_low',
    severity: 'high',
    frequency: 0.10, // 10% chance
    title: 'Disk Space Running Low',
    description: 'Disk usage above 85%',
    labels: { instance: 'db-server-01', alertname: 'DiskSpaceLow', job: 'node-exporter', mountpoint: '/data' },
    annotations: { summary: 'Disk at 87% capacity', description: 'Clean up old logs or expand volume' },
  },
  {
    name: 'api_latency_high',
    severity: 'high',
    frequency: 0.15, // 15% chance
    title: 'API Response Time Degraded',
    description: 'P95 latency exceeds 2 seconds',
    labels: { service: 'api-gateway', alertname: 'HighLatency', endpoint: '/api/users' },
    annotations: { summary: 'P95 latency: 2.4s', dashboard: 'https://grafana.example.com/d/api' },
  },
  {
    name: 'error_rate_spike',
    severity: 'critical',
    frequency: 0.10, // 10% chance
    title: 'Error Rate Spike Detected',
    description: '5xx errors increased by 500%',
    labels: { service: 'payment-service', alertname: 'ErrorRateHigh', status_code: '500' },
    annotations: { summary: 'Error rate: 15% (normal: 0.5%)', logs: 'https://logs.example.com' },
  },
  {
    name: 'database_connection_pool',
    severity: 'high',
    frequency: 0.08, // 8% chance
    title: 'Database Connection Pool Exhausted',
    description: 'All database connections are in use',
    labels: { instance: 'db-pool-01', alertname: 'DBPoolExhausted', database: 'postgres' },
    annotations: { summary: 'Active connections: 100/100', action: 'Increase pool size or check for connection leaks' },
  },
  {
    name: 'ssl_certificate_expiry',
    severity: 'medium',
    frequency: 0.05, // 5% chance
    title: 'SSL Certificate Expiring Soon',
    description: 'SSL certificate expires in 7 days',
    labels: { domain: 'api.example.com', alertname: 'SSLExpiringSoon' },
    annotations: { summary: 'Certificate expires: 2026-02-11', action: 'Renew SSL certificate' },
  },
  {
    name: 'backup_failed',
    severity: 'high',
    frequency: 0.07, // 7% chance
    title: 'Automated Backup Failed',
    description: 'Database backup job failed',
    labels: { job: 'backup-service', alertname: 'BackupFailed', database: 'production' },
    annotations: { summary: 'Backup failed at 02:00 UTC', error: 'Connection timeout' },
  },
  {
    name: 'pod_crashloop',
    severity: 'critical',
    frequency: 0.05, // 5% chance
    title: 'Kubernetes Pod CrashLooping',
    description: 'Pod is repeatedly crashing',
    labels: { namespace: 'production', pod: 'web-deployment-7f9c8d-x5k2j', alertname: 'PodCrashLoop' },
    annotations: { summary: 'Restart count: 12', logs: 'kubectl logs web-deployment-7f9c8d-x5k2j' },
  },
  {
    name: 'cache_hit_rate_low',
    severity: 'medium',
    frequency: 0.10, // 10% chance
    title: 'Cache Hit Rate Degraded',
    description: 'Redis cache hit rate below 70%',
    labels: { instance: 'redis-01', alertname: 'LowCacheHitRate', cluster: 'cache-cluster' },
    annotations: { summary: 'Hit rate: 65% (target: >85%)', action: 'Check cache key patterns' },
  },
  {
    name: 'queue_backlog',
    severity: 'medium',
    frequency: 0.05, // 5% chance
    title: 'Message Queue Backlog Growing',
    description: 'Queue depth exceeds threshold',
    labels: { queue: 'email-notifications', alertname: 'QueueBacklog', service: 'rabbitmq' },
    annotations: { summary: 'Messages in queue: 15000', action: 'Scale up consumers' },
  },
];

// Generate a realistic Prometheus alert payload
function generatePrometheusAlert(scenario) {
  const now = new Date();
  const startsAt = new Date(now.getTime() - Math.random() * 10 * 60 * 1000); // Random time in last 10 minutes

  return {
    version: '4',
    groupKey: `{alertname="${scenario.labels.alertname}"}`,
    status: 'firing',
    receiver: 'openalert',
    groupLabels: { alertname: scenario.labels.alertname },
    commonLabels: scenario.labels,
    commonAnnotations: scenario.annotations,
    externalURL: 'http://prometheus:9093',
    alerts: [
      {
        status: 'firing',
        labels: {
          severity: scenario.severity,
          ...scenario.labels,
        },
        annotations: {
          title: scenario.title,
          description: scenario.description,
          ...scenario.annotations,
        },
        startsAt: startsAt.toISOString(),
        endsAt: '0001-01-01T00:00:00Z', // Still firing
        generatorURL: 'http://prometheus:9090/graph?g0.expr=up%7Bjob%3D%22node%22%7D&g0.tab=1',
        fingerprint: Math.random().toString(36).substring(7),
      },
    ],
  };
}

// Generate a Grafana alert payload
function generateGrafanaAlert(scenario) {
  const now = new Date();

  return {
    title: scenario.title,
    state: 'alerting',
    message: scenario.description,
    evalMatches: [
      {
        value: Math.random() * 100,
        metric: scenario.name,
        tags: scenario.labels,
      },
    ],
    ruleId: Math.floor(Math.random() * 1000),
    ruleName: scenario.title,
    ruleUrl: 'https://grafana.example.com/alerting/rule/123',
    orgId: 1,
    dashboardId: 1,
    panelId: 1,
    tags: scenario.labels,
    imageUrl: '',
    time: now.toISOString(),
  };
}

// Generate a generic webhook payload
function generateGenericAlert(scenario) {
  return {
    title: scenario.title,
    description: scenario.description,
    severity: scenario.severity,
    status: 'firing',
    source: 'alert-simulator',
    labels: scenario.labels,
    annotations: scenario.annotations,
    timestamp: new Date().toISOString(),
  };
}

// Send alert to OpenAlert
async function sendAlert(payload, format) {
  const url = new URL(`${config.apiUrl}/webhooks/${format}/${config.integrationKey}`);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': format === 'prometheus' ? 'Alertmanager/0.25.0' :
                      format === 'grafana' ? 'Grafana/10.0.0' :
                      'AlertSimulator/1.0.0',
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: responseData });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Select a random alert scenario based on frequency weights
function selectRandomScenario() {
  const rand = Math.random();
  let cumulative = 0;

  for (const scenario of alertScenarios) {
    cumulative += scenario.frequency;
    if (rand <= cumulative) {
      return scenario;
    }
  }

  // Fallback to first scenario
  return alertScenarios[0];
}

// Main alert generation loop
async function generateAndSendAlert() {
  const scenario = selectRandomScenario();

  let payload;
  let format = config.format;

  // Generate payload based on format
  switch (format) {
    case 'grafana':
      payload = generateGrafanaAlert(scenario);
      break;
    case 'generic':
      format = 'v1'; // Generic webhook uses /webhooks/v1/
      payload = generateGenericAlert(scenario);
      break;
    case 'prometheus':
    default:
      payload = generatePrometheusAlert(scenario);
      format = 'prometheus';
      break;
  }

  try {
    console.log(`📤 [${new Date().toISOString()}] Sending ${scenario.severity.toUpperCase()} alert: ${scenario.title}`);
    const response = await sendAlert(payload, format);
    console.log(`✅ Alert sent successfully! Response: ${response.body}`);
  } catch (error) {
    console.error(`❌ Failed to send alert: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 OpenAlert Alert Simulator Started');
  console.log(`📍 API URL: ${config.apiUrl}`);
  console.log(`🔑 Integration Key: ${config.integrationKey.substring(0, 8)}...`);
  console.log(`⏱️  Interval: ${config.interval} minutes`);
  console.log(`📊 Format: ${config.format}`);
  console.log(`🎯 Scenarios: ${alertScenarios.length}`);
  console.log('─'.repeat(60));

  if (config.runOnce) {
    console.log('▶️  Running once...');
    await generateAndSendAlert();
    console.log('✅ Done!');
    process.exit(0);
  }

  // Send first alert immediately
  await generateAndSendAlert();

  // Then send alerts at regular intervals
  setInterval(async () => {
    await generateAndSendAlert();
  }, config.interval * 60 * 1000);

  console.log(`⏰ Next alert will be sent in ${config.interval} minutes`);
  console.log('Press Ctrl+C to stop');
}

main().catch(console.error);
