/**
 * Test fixtures and sample data for integration tests
 */

export const testUsers = {
  superadmin: {
    email: 'superadmin@test.com',
    name: 'Super Admin',
    role: 'superadmin',
    password: 'SuperAdmin123!',
  },
  admin: {
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin',
    password: 'Admin123!',
  },
  responder: {
    email: 'responder@test.com',
    name: 'Responder User',
    role: 'responder',
    password: 'Responder123!',
  },
  observer: {
    email: 'observer@test.com',
    name: 'Observer User',
    role: 'observer',
    password: 'Observer123!',
  },
};

export const testTeams = {
  engineering: {
    name: 'Engineering',
    slug: 'engineering',
    description: 'Engineering team',
  },
  operations: {
    name: 'Operations',
    slug: 'operations',
    description: 'Operations team',
  },
};

export const testServices = {
  api: {
    name: 'API Service',
    description: 'Main API service',
  },
  database: {
    name: 'Database',
    description: 'PostgreSQL database',
  },
  cache: {
    name: 'Redis Cache',
    description: 'Redis caching service',
  },
};

export const testSchedules = {
  primary: {
    name: 'Primary On-Call',
    timezone: 'America/New_York',
  },
  secondary: {
    name: 'Secondary On-Call',
    timezone: 'America/Los_Angeles',
  },
};

export const testEscalationPolicies = {
  default: {
    name: 'Default Escalation',
    description: 'Standard escalation policy',
  },
  urgent: {
    name: 'Urgent Escalation',
    description: 'Fast escalation for critical issues',
  },
};

export const prometheusAlertPayload = {
  alerts: [
    {
      status: 'firing',
      labels: {
        alertname: 'HighMemoryUsage',
        severity: 'critical',
        instance: 'server1',
        job: 'node-exporter',
      },
      annotations: {
        summary: 'High memory usage detected',
        description: 'Memory usage is above 90% on server1',
      },
      startsAt: new Date().toISOString(),
      endsAt: null,
      generatorURL: 'http://prometheus.example.com/graph',
    },
  ],
};

export const grafanaAlertPayload = {
  title: 'High CPU Alert',
  state: 'alerting',
  message: 'CPU usage is above threshold',
  evalMatches: [
    {
      metric: 'cpu_usage',
      tags: { host: 'server1' },
      value: 95,
    },
  ],
  ruleId: 1,
  ruleName: 'High CPU',
  ruleUrl: 'http://grafana.example.com/dashboard',
};

export const datadogAlertPayload = {
  title: 'High Error Rate',
  body: 'Error rate is above 5% for the last 5 minutes',
  alert_type: 'error',
  priority: 'normal',
  tags: ['env:prod', 'service:api', 'team:backend'],
  date_happened: Math.floor(Date.now() / 1000),
};

export const genericAlertPayload = {
  title: 'Custom Alert',
  severity: 'high',
  status: 'firing',
  source: 'custom-monitoring',
  description: 'Something went wrong in production',
  labels: {
    environment: 'production',
    component: 'payment-service',
  },
  annotations: {
    runbook: 'https://wiki.example.com/runbooks/payment-issues',
  },
};

export const statusPageIncidentPayload = {
  title: 'API Degradation',
  description: 'We are experiencing slower than normal API response times',
  status: 'investigating',
  impact: 'minor',
  affectedServices: ['api'],
};
