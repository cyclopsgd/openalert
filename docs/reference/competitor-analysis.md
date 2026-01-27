# Incident Management Platform Competitor Analysis

## Executive Summary

This document analyzes six incident management platforms to identify features, architecture patterns, and integration approaches for OpenAlert development. The analysis covers Atlassian Opsgenie, incident.io, ilert, Grafana OnCall OSS, Rootly, and FireHydrant.

**Key Market Insights:**
- Opsgenie EOL announced for April 2027, creating migration opportunity
- Grafana OnCall OSS entering maintenance mode (archive: March 2026)
- Slack-native platforms (incident.io, Rootly, FireHydrant) gaining market share
- AI features becoming table stakes across all platforms
- European compliance (GDPR, ISO 27001) increasingly important

---

## 1. Atlassian Opsgenie

### Overview
Founded 2012, acquired by Atlassian 2018. Integrated with Jira Service Management. **EOL announced for April 2027** - users being pushed to JSM.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OPSGENIE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│  External Systems (Prometheus, Datadog, Jenkins, Slack)     │
│                           │                                  │
│                           ▼                                  │
│              ┌────────────────────────┐                     │
│              │   API Gateway/Webhooks  │                     │
│              └────────────────────────┘                     │
│                           │                                  │
│                           ▼                                  │
│              ┌────────────────────────┐                     │
│              │      Alert Engine       │                     │
│              │  - Rules processing     │                     │
│              │  - Priority assignment  │                     │
│              │  - Deduplication        │                     │
│              └────────────────────────┘                     │
│                           │                                  │
│              ┌────────────┼────────────┐                    │
│              ▼            ▼            ▼                    │
│     ┌──────────────┐ ┌──────────┐ ┌──────────────┐        │
│     │Routing Rules │ │Escalation│ │Notification  │        │
│     │              │ │ Policies │ │  Policies    │        │
│     └──────────────┘ └──────────┘ └──────────────┘        │
│                           │                                  │
│                           ▼                                  │
│              ┌────────────────────────┐                     │
│              │   Notification System   │                     │
│              │  SMS, Voice, Push, Email│                     │
│              └────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Core Features

#### Alert Routing Rules
- **Condition-based routing**: Route by source, priority, tags, time of day, message content
- **If/And Then logic**: Flexible filters for complex routing scenarios
- **Route destinations**: Schedule, Escalation Policy, or "No One" (silent logging)
- **First-match wins**: Rules evaluated in order, first match routes the alert

```
Example Routing Rules:
1. IF priority = P1 AND time = after-hours → Route to On-Call Escalation
2. IF tags contains "database" → Route to DBA Team Escalation
3. IF priority = P5 → Route to No One (log only)
4. DEFAULT → Route to Default Escalation
```

#### On-Call Scheduling
- **Rotation types**: Daily, weekly, custom intervals
- **Multiple rotations per schedule**: Business hours, after-hours, weekends
- **Time restrictions**: Rotations can be limited to specific time windows
- **Schedule layers**: Multiple overlapping rotations (cumulative notification)
- **Overrides**: Ad-hoc exceptions without modifying base schedule
- **Forwarding rules**: Users can forward notifications to another user
- **Timezone support**: Per-schedule timezone configuration

#### Escalation Policies
- **Multi-step escalation**: Up to 20 repeat cycles
- **Escalation conditions**: 
  - If not acknowledged
  - If not closed
  - Unconditional (always escalate)
- **Escalation targets**:
  - Notify user
  - Notify schedule (on-call users)
  - Notify next user in schedule
  - Notify previous user in schedule
  - Notify all team members
  - Notify group
  - Notify random team member
- **Repeat options**: Loop escalation chain with optional state reset
- **Auto-close**: Automatically close after escalation completes

#### Notification Policies (Premium Feature)
- **De-escalation**: Suppress notifications based on conditions
- **Auto-close policy**: Close alerts after specified time
- **Auto-restart**: Restart notification flow after timeout
- **Notification filtering**: Modify how alerts are delivered

#### Incoming Call Routing
- Route inbound phone calls to on-call teams
- IVR menu support
- Voicemail if no answer
- Automatic alert acknowledgment on answer

### Integration Architecture

**200+ integrations** via:
1. **Native integrations**: Pre-built connectors (Datadog, Prometheus, AWS, etc.)
2. **API**: RESTful API with full CRUD operations
3. **Webhooks**: Inbound and outbound
4. **Email integration**: Parse email alerts into Opsgenie alerts

**API Capabilities:**
- Alert API: Create, acknowledge, close, snooze, add notes
- Schedule API: CRUD operations on schedules and overrides
- Escalation API: Manage escalation policies
- User/Team API: User and team management
- Integration API: Manage integration configurations

### User Feedback

**Praised:**
- Flexible routing rules based on payload elements
- Strong Jira/Atlassian ecosystem integration
- Mature, battle-tested platform
- Good mobile apps

**Complained:**
- Complex setup, steep learning curve
- Confusing relationship between schedules, escalations, and routing
- 2022 outage lasted 2 weeks for some customers (reliability concerns)
- Premium features locked behind expensive tiers
- Uncertain future with JSM migration push

### Features Worth Replicating
1. ✅ Flexible If/And Then routing rules
2. ✅ Multiple rotation types per schedule
3. ✅ Escalation repeat with state reset option
4. ✅ "Route to No One" for silent logging
5. ✅ Schedule overrides without modifying base config
6. ✅ Incoming call routing to on-call

---

## 2. incident.io

### Overview
Founded 2021. Slack-native incident management. Raised significant funding. Used by Netflix, Etsy, Intercom, Skyscanner. Recently added On-Call capabilities (2024).

### Architecture Philosophy

**Slack-Native means:**
- Entire workflow lives in Slack slash commands
- No context switching to web UI during incidents
- `/inc declare`, `/inc assign`, `/inc escalate`, `/inc resolve`
- Web dashboard for configuration and analytics only

```
┌─────────────────────────────────────────────────────────────┐
│                  INCIDENT.IO ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │  Monitoring │    │   Manual    │    │   Slack     │    │
│   │   (Datadog, │    │  Declaration│    │  Shortcuts  │    │
│   │    Sentry)  │    │             │    │             │    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │     Alert Sources      │                     │
│              │   (Webhook endpoints)  │                     │
│              └────────────────────────┘                     │
│                             │                               │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │    Alert Routing &     │                     │
│              │    Expressions Engine  │                     │
│              └────────────────────────┘                     │
│                             │                               │
│          ┌──────────────────┼──────────────────┐           │
│          ▼                  ▼                  ▼           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │  Escalation │    │   Incident  │    │   Slack     │   │
│   │    Paths    │    │   Channel   │    │   Alert     │   │
│   │             │    │  Creation   │    │   Posting   │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│          │                  │                               │
│          ▼                  ▼                               │
│   ┌─────────────┐    ┌─────────────┐                       │
│   │ On-Call     │    │  Workflows  │                       │
│   │ Schedules   │    │  Engine     │                       │
│   └─────────────┘    └─────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Core Features

#### Slack-Native Incident Response
- **Channel auto-creation**: Dedicated channel per incident
- **Pre-populated context**: Alert details, service owners, recent deployments
- **Role assignment**: `/inc role lead @sarah`
- **Severity management**: `/inc severity high`
- **Timeline capture**: Automatic from Slack conversation
- **AI summaries**: Real-time incident summaries

#### On-Call (Launched 2024)
**Components:**
1. **Alerts**: Connect monitoring tools (Datadog, Sentry, Prometheus Alertmanager)
2. **Schedules**: Who should be on-call and when
3. **Escalation Paths**: Who to contact when something goes wrong
4. **Notifications**: SMS, phone, email, Slack, mobile push

**Notification Features:**
- Multiple rules per method
- Delayed notifications (up to 10 minutes)
- Shift change notifications
- Calendar sync (Google, Outlook)

#### Service Catalog (Called "Catalog")
**Not just services** - models entire organization:
- Services with owners, dependencies, alert channels
- Teams with managers, tech leads
- Features linked to teams
- Customers linked to CSMs

**Derived Custom Fields:**
- Set "affected customer" → automatically sets "responsible CSM"
- Reduces cognitive load during incidents

**Catalog uses:**
- Route alerts based on ownership
- Auto-invite right people to incidents
- Power workflow automations
- Drive status page sub-pages

#### Workflows Engine
- Trigger on incident events (created, severity changed, resolved)
- Actions: Page teammates, send updates, assign roles, create follow-ups
- Condition-based: Only run for specific severities, services, etc.
- Template variables for dynamic content

#### Status Pages
- Public and private pages
- Subscriber notifications
- Catalog-powered sub-pages (by region, product, etc.)
- Direct updates from Slack

#### Post-Mortems
- Auto-generated from incident timeline
- AI-drafted summaries
- Follow-up action tracking
- Export to Linear, Jira, etc. from Slack

### API & Integration

**OpenAPI documented REST API:**
- Incidents API: Full CRUD, transitions, updates
- Catalog API: Manage types, entries, relationships
- Alerts API: Create incidents from alerts
- Schedules API: Manage on-call schedules
- Escalations API: List and filter escalations

**Terraform Provider:**
- Manage catalog types, entries
- Configure alert sources, routes
- Infrastructure-as-code for incident management config

**70+ Integrations:**
- Monitoring: Datadog, New Relic, Prometheus, Sentry, Grafana
- Issue tracking: Jira, Linear, GitHub, Asana
- Communication: Slack, Microsoft Teams, Zoom, Google Meet
- Status pages: Built-in, plus export to Statuspage
- ITSM: ServiceNow

**Native Alertmanager Notifier:**
- Direct integration in Prometheus Alertmanager config

### User Feedback

**Praised:**
- Outstanding Slack-native UX
- Rapid time-to-value (operational in 3 days)
- Excellent customer support (9.8/10 rating)
- AI features that actually help
- Fast feature development velocity
- Intuitive, polished interface

**Complained:**
- Not a dedicated SLO platform
- Pricing can be high for large teams
- Relatively new on-call features (less mature than alerting veterans)
- Best experience requires strong Slack adoption

### Features Worth Replicating
1. ✅ Slack-native incident channel creation with context
2. ✅ Catalog with derived fields (automatic field population)
3. ✅ Timeline auto-capture from chat
4. ✅ AI-generated summaries and post-mortems
5. ✅ Workflow engine with triggers and conditions
6. ✅ Calendar sync for schedules
7. ✅ Status page sub-pages powered by catalog

---

## 3. ilert

### Overview
German company (founded ~2018). Strong European compliance focus. Positions as modern PagerDuty alternative with transparent pricing.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ILERT ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│  Hosted on AWS EU (Frankfurt) + EU DR regions               │
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │  Monitoring │    │  Inbound    │    │   Email     │    │
│   │   Tools     │    │   Calls     │    │   Parser    │    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │     Alert Sources      │                     │
│              │  + Event Flows (Scale) │                     │
│              └────────────────────────┘                     │
│                             │                               │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │   AI Alert Grouping    │                     │
│              │  (Semantic similarity) │                     │
│              └────────────────────────┘                     │
│                             │                               │
│          ┌──────────────────┼──────────────────┐           │
│          ▼                  ▼                  ▼           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │  Escalation │    │    Call     │    │   Status    │   │
│   │   Policies  │    │   Routing   │    │    Pages    │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│          │                  │                               │
│          ▼                  ▼                               │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Notification System                     │  │
│   │    SMS, Voice, Push, Email, Slack, Teams            │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Core Features

#### Alerting & Notifications
- Multi-channel: SMS, voice, push, email
- Alert deduplication
- **AI-powered alert grouping**: Semantic similarity grouping (alerts with similar meaning grouped even if content differs)
- Alert enrichment

#### On-Call Management
- Schedules with/without rotations
- Overrides for shift swaps
- Gap detection
- On-call reminders
- **On-call metrics**: Time on-call, alerts during shift, time spent on alerts (for compensation)

#### Escalation Policies
- Multi-level escalation
- Parallel notification per level
- Connection to schedules

#### Call Routing (Differentiator)
**Far more advanced than PagerDuty:**
- Custom IVR menus in multiple languages
- PIN code verification
- AI Agent as frontline responder
- Text-to-speech with human-like voice
- Drag-and-drop call flow builder
- Voicemail support
- Blacklists
- Support hours routing
- Simultaneous calling (up to 10 responders in parallel)
- Call logs for audit

**Call Flow Features:**
- Multiple IVR menu levels
- Route based on support hours
- Secret PIN codes for security
- Language selection for global audience

#### Status Pages
- Public status pages (free on Pro/Premium)
- Private status pages with access control:
  - Whitelisted email domains
  - Magic link authentication
- Audience-specific pages
- GDPR-compliant double opt-in for subscribers
- Automatic opt-in reminders

#### Event Flows (Scale Plan)
- Visual drag-and-drop workflow builder
- Custom routing based on priority, source, support hours
- Automation for event handling

#### ilert AI (Included in All Plans)
- **Schedule generation**: Describe requirements in chat, AI generates schedule
- **ilert Responder**: Root cause analysis, remediation suggestions during incidents
- **Status page messaging**: AI helps identify affected services, drafts customer communication
- **Postmortem creation**: Generate from Slack AND Microsoft Teams chats

### European Compliance Focus

**GDPR Compliance:**
- 100% GDPR compliant
- EU data residency (AWS Frankfurt + EU DR regions)
- External Data Protection Officer appointed
- Double opt-in for status page subscribers

**Security Certifications:**
- ISO 27001 certified
- BSI IT-Grundschutz principles
- Regular external penetration tests
- Published security policies

### Pricing Transparency

| Feature | ilert | PagerDuty |
|---------|-------|-----------|
| Stakeholder license | €50 for 50 viewers | $150 |
| Private status pages | €156/month | $599/month |
| Audience-specific pages | €62/month | Part of $599 |
| AI features | Included | $699+/month AIOps add-on |
| ChatOps | Included | Higher tiers only |

**Free tier includes public status page** (PagerDuty doesn't)

### Integration Approach

**Terraform Provider** for infrastructure-as-code

**Pre-built integrations:**
- PRTG Network Monitor
- Datto Autotask
- Prometheus
- Checkmk
- Datadog
- Zabbix
- Many more

**ITSM integrations:**
- Jira
- ServiceNow
- TOPdesk

### User Feedback

**Praised:**
- Simple, clean concept (clear separation between Alerts & Incidents)
- Flexible on-call timetable (best-in-class according to some)
- Reliable alerting
- Good integrations
- Easy setup
- Competitive pricing
- Excellent for European compliance requirements

**Complained:**
- No "live alerts" dashboard webpage
- No dark mode
- Mobile app can lag occasionally
- Some advanced settings require extra documentation
- Not all integrations available (growing)
- US-based support may have 12+ hour response times (German company)

### Features Worth Replicating
1. ✅ Advanced call routing with IVR builder
2. ✅ AI-powered semantic alert grouping
3. ✅ On-call metrics for compensation tracking
4. ✅ Status page access control (whitelisted domains, magic links)
5. ✅ AI assistant for schedule generation
6. ✅ Support hours-based routing
7. ✅ GDPR-compliant double opt-in

---

## 4. Grafana OnCall OSS

### Overview
Originally Amixr (founded 2018), acquired by Grafana Labs 2021. Open-sourced 2022. **Entered maintenance mode March 2025, archive March 2026.** Cloud version continues as part of Grafana Cloud IRM.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 GRAFANA ONCALL OSS ARCHITECTURE              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │  Grafana    │    │ Prometheus  │    │   Zabbix    │    │
│   │  Alerting   │    │ Alertmanager│    │   & Others  │    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │     Integrations       │                     │
│              │  (Webhook endpoints)   │                     │
│              └────────────────────────┘                     │
│                             │                               │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │     Alert Grouping     │                     │
│              │  + Jinja2 Templates    │                     │
│              └────────────────────────┘                     │
│                             │                               │
│                             ▼                               │
│              ┌────────────────────────┐                     │
│              │        Routes          │                     │
│              │   (Regex matching)     │                     │
│              └────────────────────────┘                     │
│                             │                               │
│          ┌──────────────────┼──────────────────┐           │
│          ▼                  ▼                  ▼           │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │  Escalation │    │   ChatOps   │    │  Outgoing   │   │
│   │   Chains    │    │   (Slack,   │    │  Webhooks   │   │
│   │             │    │   Teams,    │    │             │   │
│   │             │    │   Telegram) │    │             │   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │               On-Call Schedules                      │  │
│   │         (Calendar-based management)                  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
│  Backend: Django/Python + Celery + RabbitMQ + Redis + PG   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack (OSS)
- **Backend**: Python/Django
- **Task Queue**: Celery with RabbitMQ
- **Cache**: Redis
- **Database**: PostgreSQL
- **Frontend**: React (embedded in Grafana)

### Core Features

#### Alert Grouping
**Alert Group States:**
- **Firing**: Escalation policy active
- **Acknowledged**: Escalation interrupted (can unacknowledge to restart)
- **Silenced**: Temporary acknowledgment with timeout, then returns to Firing
- **Resolved**: Escalation stopped permanently

**Grouping options:**
- Time-window grouping (group all events for X minutes)
- Template-based grouping (Jinja2 expressions)

#### Integrations
**Supported monitoring systems:**
- Grafana Alerting (native)
- Grafana Mimir
- Prometheus Alertmanager
- Zabbix
- Generic webhook
- Inbound email

**Integration features:**
- Per-integration webhook endpoints
- Jinja2 templating for alert appearance
- Demo alerts for testing
- Heartbeat monitoring (health check)
- Maintenance mode (Debug or full)

#### Routes
- Route alerts to different escalation chains based on labels/data
- Regex matching support
- Default route fallback
- Per-route escalation chain selection

#### Escalation Chains
**Available steps:**
| Step Type | Description |
|-----------|-------------|
| Wait | Pause for specified duration |
| Notify users | Individual or group notification |
| Notify users from on-call schedule | Current on-call responders |
| Notify all team members | Entire team |
| Notify Slack channel members | Users in Slack channel |
| Notify Slack user group | Slack user group members |
| Round robin notifications | Sequential per alert group |
| Trigger outgoing webhook | HTTP webhook action |
| Resolve automatically | Close alert group |
| Repeat escalation | Loop chain (up to 5 times) |

**Notification rule sets:**
- Default notifications (standard alerts)
- Important notifications (high-priority)
- Per-step selection of which rule set to use

#### On-Call Schedules
- **Calendar-based management**: Google Calendar, Outlook integration
- **Rotations**: Scheduled shifts
- **Overrides**: One-time exceptions
- **Shift swaps**: User-initiated exchanges
- **Timezone support**: Per-schedule

#### ChatOps
- **Slack**: Deep integration, notifications in threads, user verification
- **Microsoft Teams**: Full support
- **Telegram**: Notification support

**Slack features:**
- `/escalate` command
- Message shortcut: "Add to resolution note"
- Alert notifications in channels
- User profile linking

#### Notifications (OSS Limitations)
**Cloud Connection required for:**
- SMS notifications
- Phone call notifications  
- Mobile app push notifications

**Self-hosted alternatives:**
- Configure own Twilio account for SMS/phone
- Use Pushover, Gotify, or ntfy for push
- Email always available

#### Outgoing Webhooks
- Trigger on alert group events
- Custom HTTP requests to external systems
- Available as escalation step

### Maintenance Mode Implications

**After March 2026:**
- GitHub repo read-only
- No feature development
- Only critical bugs and high-severity CVEs (CVSS 7.0+)
- Cloud Connection services discontinued
- Mobile app push stops working
- Twilio integration continues (self-configured)

**Migration path**: Grafana Cloud IRM (paid)

### User Feedback

**Praised:**
- Simple, developer-friendly UX
- Deep Grafana ecosystem integration
- Free and open source
- Calendar-based schedule management
- Good Slack integration
- Active community (while maintained)

**Complained:**
- OSS version going away
- Cloud Connection dependency for key features
- Limited without Grafana Cloud
- Fewer integrations than commercial alternatives
- No built-in status pages

### Features Worth Replicating
1. ✅ Jinja2 templating for alert appearance
2. ✅ Alert group states (Firing/Ack/Silenced/Resolved)
3. ✅ Calendar sync for schedule management
4. ✅ Heartbeat monitoring for integration health
5. ✅ Maintenance mode (Debug vs full)
6. ✅ Round-robin notification step
7. ✅ Resolution notes from Slack messages

---

## 5. Rootly

### Overview
Founded ~2020. AI-native incident management. Strong Slack integration. Claims 8.5% market share in IT Alerting/Incident Management. Used by NVIDIA, Squarespace, Canva, Grammarly, LinkedIn.

### Architecture Philosophy

**End-to-end platform:**
- On-call alerting
- Incident response
- Post-mortems
- Status pages
- All integrated

**Multi-cloud alerting infrastructure:**
- Not dependent on single cloud provider
- Continues working even if AWS goes down

### Core Features

#### Workflows Engine (Differentiator)
**More flexible than competitors' runbooks:**
- Trigger on incident conditions
- Auto-create incident channels
- Pull in right on-call responders
- Set up video conference
- Assign roles
- Update stakeholders
- Customizable for unique scenarios

**vs FireHydrant Runbooks:**
Rootly workflows are more dynamic and customizable; FireHydrant runbooks are more like automated checklists.

#### AI SRE
- **91% faster incident resolution** (claimed)
- Root cause identification
- Fix suggestions
- PR generation
- Shows its work (cites sources)

#### On-Call Management
- Schedules with gap detection
- Automatic gap assignment to Schedule Owner
- Page teams, individuals, or services
- No workarounds needed (unlike PagerDuty's "model as service")
- Override management
- Intuitive UI for schedule creation

#### Incident Response
- Dedicated Slack channel per incident
- Video conference bridge setup
- Automatic timeline reconstruction
- Role assignment
- Severity management

#### Postmortems
- **Automatic timeline reconstruction** from:
  - Slack conversations
  - Jira tickets
  - Monitoring alerts
  - Other integrated tools
- Blameless report generation
- AI-assisted analysis
- Single source of truth per incident

#### Status Pages
- Public status pages
- Component status
- Incident communication
- Subscriber notifications

### Integration Approach

**70+ integrations:**
- Observability tools
- Task management
- Collaboration tools

**API-first design:**
- Extensive programmatic control
- Custom integration building

### Pricing
- 14-day free trial
- Enterprise pricing (contact sales)
- Claims "half the cost of PagerDuty"

### User Feedback

**Praised:**
- Most useful integrations
- Simple, easy to use
- Highly customizable
- Great customer support
- Competitive pricing
- Fast feature delivery
- Intuitive schedule management

**Complained:**
- Enterprise pricing model (no public pricing)
- Newer platform (less battle-tested than PagerDuty)
- Some users prefer more structure (FireHydrant strength)

### Features Worth Replicating
1. ✅ Automatic timeline reconstruction from multiple sources
2. ✅ Gap detection in schedules with auto-assignment
3. ✅ Flexible workflows engine (beyond runbooks)
4. ✅ Multi-cloud infrastructure for reliability
5. ✅ Page teams OR individuals OR services flexibly
6. ✅ AI-assisted postmortem generation

---

## 6. FireHydrant

### Overview
Founded 2016. Focus on process structure and service catalog. 1.6% market share (smaller than Rootly). Strong enterprise focus.

### Architecture Philosophy

**Service Catalog as foundation:**
- Map services and dependencies
- Ownership tracking
- Context-aware incident response
- Understand blast radius

### Core Features

#### Service Catalog (Differentiator)
- Services with owners
- Dependency mapping
- Team associations
- Runbook links
- Used for context during incidents

#### Runbooks
- **Automated checklists** for incident response
- Standardize procedures across teams
- Less flexible than Rootly workflows
- Better for organizations wanting strict process

#### Incident Management
- Slack integration (web-first with Slack notifications, unlike incident.io)
- Dedicated incident channels
- Role assignment
- Severity management
- Timeline tracking

#### Retrospectives
- Post-incident documentation
- Action item tracking
- More manual than Rootly (relies on responder input)

#### Analytics
- Incident impact understanding
- Team performance metrics
- Service reliability tracking

### Integration Approach
- Slack and Jira integration highlighted
- Connects to existing workflows
- Less emphasis on breadth of integrations

### Pricing
- **Incident Management Pro**: $6,000/year (no monthly option)
- Enterprise pricing for additional features

### User Feedback

**Praised:**
- Strong service catalog
- Good for teams wanting structure
- Solid Slack and Jira integration
- Quality customer support
- Good for complex service architectures

**Complained:**
- Web-first architecture (not truly Slack-native)
- Configuration can be challenging
- Steeper learning curve than Rootly
- Less customization flexibility
- Higher pricing for smaller teams

### Features Worth Replicating
1. ✅ Service catalog with dependency mapping
2. ✅ Runbooks as structured checklists
3. ✅ Blast radius understanding from dependencies
4. ✅ Strong retrospective workflow

---

## Cross-Platform Comparison Matrix

### Core Capabilities

| Feature | Opsgenie | incident.io | ilert | Grafana OnCall | Rootly | FireHydrant |
|---------|----------|-------------|-------|----------------|--------|-------------|
| On-Call Scheduling | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Escalation Policies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alert Routing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Status Pages | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Incident Management | Basic | ✅ | Basic | Basic | ✅ | ✅ |
| Post-Mortems | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Service Catalog | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| AI Features | ❌ | ✅ | ✅ | ❌ | ✅ | Limited |

### Architecture Approach

| Platform | Primary Interface | Architecture Style |
|----------|-------------------|-------------------|
| Opsgenie | Web + Mobile | Web-first |
| incident.io | Slack | Chat-native |
| ilert | Web + Mobile | Web-first |
| Grafana OnCall | Grafana UI | Grafana-native |
| Rootly | Slack | Chat-native |
| FireHydrant | Web | Web-first with Slack |

### Pricing Models

| Platform | Starting Price | Notable |
|----------|---------------|---------|
| Opsgenie | Free tier, $9/user/mo | EOL 2027 |
| incident.io | $15/user/mo (Team) | Add $10-20 for on-call |
| ilert | €12/user/mo (Free tier) | Transparent pricing |
| Grafana OnCall | Free (OSS) | Archive 2026 |
| Rootly | Enterprise only | "Half PagerDuty cost" |
| FireHydrant | $6,000/year | Annual only |

### Compliance & Hosting

| Platform | GDPR | SOC 2 | ISO 27001 | Self-Hosted |
|----------|------|-------|-----------|-------------|
| Opsgenie | ✅ | ✅ | ❌ | ❌ |
| incident.io | ✅ | ✅ | ❌ | ❌ |
| ilert | ✅ (EU-hosted) | ❌ | ✅ | ❌ |
| Grafana OnCall | N/A | N/A | N/A | ✅ |
| Rootly | ✅ | ✅ | ❌ | ❌ |
| FireHydrant | ✅ | ✅ | ❌ | ❌ |

---

## Recommendations for OpenAlert

### Must-Have Features (All Platforms Have)
1. On-call scheduling with rotations
2. Escalation policies with multiple steps
3. Alert routing based on conditions
4. Multi-channel notifications (SMS, voice, push, email)
5. Slack/Teams integration
6. Override/shift swap capability

### High-Value Differentiators to Implement

#### From Opsgenie
- **Flexible If/And Then routing rules** with payload inspection
- **"Route to No One"** option for silent logging
- **Escalation repeat with state reset**

#### From incident.io
- **Service Catalog with derived fields** (auto-populate related fields)
- **Slack-native incident channels** with auto-populated context
- **Timeline auto-capture** from chat
- **Workflow engine** with triggers and conditions
- **Status page sub-pages** powered by catalog

#### From ilert
- **Advanced call routing with IVR builder**
- **AI-powered semantic alert grouping**
- **On-call metrics** for compensation tracking
- **GDPR-compliant status page subscribers** (double opt-in)
- **Support hours-based routing**

#### From Grafana OnCall
- **Jinja2 templating** for alert appearance
- **Alert group states** (Firing/Ack/Silenced/Resolved)
- **Heartbeat monitoring** for integration health
- **Calendar sync** (Google/Outlook) for schedules
- **Maintenance mode** with Debug option

#### From Rootly
- **Automatic timeline reconstruction** from multiple sources
- **Schedule gap detection** with auto-assignment
- **AI-assisted postmortem generation**

#### From FireHydrant
- **Service dependency mapping** for blast radius
- **Runbooks as structured checklists**

### Architecture Recommendations

1. **Support both Slack-native AND web-first workflows**
   - Users should be able to run incidents entirely from Slack OR the web UI
   - Don't force one paradigm

2. **Build a flexible Catalog/Service Registry early**
   - Services, teams, escalations, schedules all connect
   - Powers routing, workflows, status pages
   - Enables derived fields for automation

3. **Implement a proper Event Orchestration layer**
   - Goes beyond simple routing rules
   - Support conditions, actions, transformations
   - Enable noise reduction (grouping, deduplication, suppression)

4. **Make AI features integrated, not add-ons**
   - ilert's approach: AI included in all plans
   - Use for: alert grouping, postmortem drafting, schedule suggestions

5. **Design for European compliance from day one**
   - EU data residency option
   - GDPR features (double opt-in, data export, deletion)
   - ISO 27001-ready architecture

### Market Positioning

**OpenAlert's opportunity:**
1. **Timing**: Opsgenie EOL (2027) + Grafana OnCall OSS archive (2026) = migration wave
2. **Self-hosted**: Only option after Grafana OnCall goes away
3. **Feature parity**: Match PagerDuty AIOps without $699/month add-on
4. **Compliance**: EU-friendly alternative to US-only platforms
5. **Transparency**: Open source with clear documentation

---

## Appendix: API Patterns Worth Studying

### incident.io API Structure
```
/incidents - CRUD operations
/incident_types - Severity, type definitions
/catalog - Service catalog management
/schedules - On-call schedule management
/escalation_paths - Escalation configuration
/alerts - Alert source and route management
/webhooks - Outbound webhook subscriptions
```

### Opsgenie API Structure
```
/alerts - Alert management
/schedules - Schedule CRUD and overrides
/escalation - Escalation policy management
/teams - Team management
/users - User management
/integrations - Integration configuration
/policies - Notification policies
```

### Common Patterns
- RESTful endpoints
- Pagination for list endpoints
- Webhook subscriptions for events
- API key authentication
- OpenAPI/Swagger documentation
- Terraform provider for IaC
