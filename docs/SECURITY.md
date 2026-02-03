# OpenAlert Security Guide

Comprehensive security documentation for OpenAlert deployment and operation.

## Table of Contents

- [Security Features](#security-features)
- [Authentication](#authentication)
- [Authorization (RBAC)](#authorization-rbac)
- [Secure Configuration](#secure-configuration)
- [API Security](#api-security)
- [Network Security](#network-security)
- [Data Protection](#data-protection)
- [Vulnerability Management](#vulnerability-management)
- [Incident Response](#incident-response)
- [Compliance](#compliance)
- [Security Best Practices](#security-best-practices)

## Security Features

OpenAlert implements multiple layers of security:

### Built-in Security Controls

1. **Authentication**: JWT-based authentication with 7-day token expiry
2. **Password Hashing**: Bcrypt with 10 rounds (cost factor)
3. **Rate Limiting**: Configurable per-endpoint throttling
4. **CORS Protection**: Whitelist-based origin validation
5. **Security Headers**: Helmet.js middleware for HTTP headers
6. **Input Validation**: class-validator for DTO validation
7. **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
8. **XSS Prevention**: Input sanitization and Content Security Policy
9. **RBAC**: Role-Based Access Control with 4 global roles + team roles
10. **Audit Logging**: Correlation IDs for request tracing

### Security Headers

OpenAlert automatically sets these security headers via Helmet.js:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'
```

## Authentication

### JWT Authentication

OpenAlert uses JSON Web Tokens (JWT) for stateless authentication.

**Token Structure:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "responder",
  "iat": 1706908800,
  "exp": 1707513600
}
```

**Token Properties:**
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiry**: 7 days from issuance
- **Storage**: Client-side (localStorage or httpOnly cookie recommended)
- **Transmission**: Authorization header: `Bearer <token>`

### Password Requirements

For local authentication, enforce strong passwords:

**Minimum Requirements:**
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Implementation:**

Update user creation to enforce password policy:

```typescript
// Example password validation (implement in DTOs)
@IsStrongPassword({
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1
})
password: string;
```

### Password Storage

Passwords are hashed using bcrypt with a cost factor of 10:

```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
```

**Never**:
- Store passwords in plain text
- Log passwords (even hashed)
- Transmit passwords over unencrypted connections
- Share passwords between users

### Multi-Factor Authentication (MFA)

**Status**: Not yet implemented

**Roadmap**: MFA support planned for v2.0 with:
- TOTP (Time-based One-Time Password)
- SMS-based codes
- Authenticator app support

## Authorization (RBAC)

### Global Roles

OpenAlert implements 4 global user roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| `superadmin` | System administrator | Full access to all resources and settings |
| `admin` | Organization administrator | Manage teams, users, services, and configurations |
| `responder` | On-call responder | Manage incidents, acknowledge/resolve alerts |
| `observer` | Read-only user | View incidents and alerts only |

### Team Roles

Within teams, users have additional role-based permissions:

| Role | Description | Permissions |
|------|-------------|-------------|
| `team_admin` | Team administrator | Manage team members, services, and schedules |
| `member` | Team member | Participate in on-call, manage incidents |
| `observer` | Team observer | View team resources (read-only) |

### Permission Matrix

| Action | Superadmin | Admin | Responder | Observer |
|--------|-----------|-------|-----------|----------|
| View incidents | ✅ | ✅ | ✅ | ✅ |
| Acknowledge incidents | ✅ | ✅ | ✅ | ❌ |
| Resolve incidents | ✅ | ✅ | ✅ | ❌ |
| Create services | ✅ | ✅ | ❌ | ❌ |
| Manage teams | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ | ❌ |
| Manage integrations | ✅ | ✅ | Team Admin | ❌ |
| Manage schedules | ✅ | ✅ | Team Admin | ❌ |

### Implementing RBAC

**Protecting Endpoints:**

```typescript
@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {

  // Superadmin, admin, and responder can acknowledge
  @Patch(':id/acknowledge')
  @RequireRole('superadmin', 'admin', 'responder')
  async acknowledge(@Param('id') id: string) {
    // ...
  }

  // Only superadmin can delete
  @Delete(':id')
  @RequireRole('superadmin')
  async delete(@Param('id') id: string) {
    // ...
  }
}
```

**Team-Based Authorization:**

```typescript
@Get(':id')
@UseGuards(JwtAuthGuard, TeamMemberGuard)
@TeamResourceDecorator('incident')
async getIncident(@Param('id') id: string) {
  // User must be a member of the team that owns this incident
}
```

## Secure Configuration

### JWT Secret

**Critical**: Use a cryptographically random secret for JWT signing.

**Generate a Secure Secret:**

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64

# Python
python -c "import secrets; print(secrets.token_hex(64))"
```

**Output Example:**
```
a7f3c2e9b1d4f6a8c3e7b9d2a5f8c1e4b7d9a3f6c8e2b5d7a9c4f1e6b8d3a7c2
```

Set in `.env`:
```bash
JWT_SECRET=a7f3c2e9b1d4f6a8c3e7b9d2a5f8c1e4b7d9a3f6c8e2b5d7a9c4f1e6b8d3a7c2
```

**Requirements:**
- Minimum 32 characters (64+ recommended)
- Cryptographically random (not a dictionary word or phrase)
- Unique per environment (dev, staging, prod)
- Never committed to version control
- Rotated periodically (e.g., quarterly)

### Cookie Secret

Similar to JWT_SECRET, generate a random secret for cookie signing:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set in `.env`:
```bash
COOKIE_SECRET=b8e4c1f7a9d3e6b2c5f8a1d4e7b9c3f6a8d2e5b7c9f1a4e6d8b3c7f2a9e5
```

### Database Credentials

**PostgreSQL Password Requirements:**
- Minimum 16 characters
- Mix of letters, numbers, and symbols
- Avoid common passwords
- Unique (not reused from other systems)

**Generate Secure Password:**
```bash
openssl rand -base64 24
```

**Store Securely:**
- Use environment variables
- Use secret managers (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
- Never log database credentials
- Restrict database user permissions (GRANT only necessary privileges)

### Environment Variable Security

**Best Practices:**

1. **Never commit `.env` to version control**
   ```bash
   # Add to .gitignore
   .env
   .env.*
   !.env.example
   ```

2. **Use different secrets per environment**
   - Development: `.env.dev`
   - Staging: `.env.staging`
   - Production: `.env.prod`

3. **Restrict file permissions**
   ```bash
   chmod 600 .env
   ```

4. **Use secret managers in production**
   - AWS: Secrets Manager or Parameter Store
   - Azure: Key Vault
   - GCP: Secret Manager
   - Kubernetes: Secrets

5. **Rotate secrets regularly**
   - JWT_SECRET: Quarterly
   - Database passwords: Annually
   - API keys: Per provider recommendation

## API Security

### HTTPS/TLS

**Enforce HTTPS in production:**

1. **Obtain SSL Certificate**
   - Use Let's Encrypt (free, automated)
   - Or purchase from CA (Digicert, Sectigo, etc.)

2. **Configure Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 443 ssl http2;
       ssl_certificate /etc/letsencrypt/live/openalert.example.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/openalert.example.com/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
   }
   ```

3. **Force HTTPS Redirect**
   ```nginx
   server {
       listen 80;
       return 301 https://$server_name$request_uri;
   }
   ```

4. **Enable HSTS**
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   ```

### Rate Limiting

Rate limiting prevents abuse and DDoS attacks.

**Default Limits:**
- **API Endpoints**: 1000 requests/minute per user
- **Webhooks**: 100 requests/minute per integration key
- **Public Endpoints**: 100 requests/minute per IP

**Configure Rate Limits:**

```bash
# In .env
RATE_LIMIT=1000  # requests per minute
```

**Custom Rate Limits (Code):**

```typescript
@Throttle({ default: { ttl: 60000, limit: 10 } })  // 10 req/min
@Post('login')
async login() {
  // ...
}
```

**Monitor Rate Limiting:**
- Log rate limit violations
- Alert on sustained high request rates
- Consider IP-based blocking for persistent abuse

### CORS Configuration

**Production CORS Settings:**

```bash
# In .env
ALLOWED_ORIGINS=https://openalert.example.com,https://app.example.com
```

**Never use `*` in production:**

```typescript
// ❌ BAD - allows all origins
app.enableCors({ origin: '*' });

// ✅ GOOD - whitelist specific origins
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
});
```

### API Token Security

**Integration Keys (Webhooks):**
- 64-character random hex strings
- Generated server-side with crypto.randomBytes
- Stored hashed in database (optional for extra security)
- Rotatable without service disruption
- Scoped to specific service

**Protecting Integration Keys:**
- Don't log integration keys
- Don't expose in error messages
- Use HTTPS for all webhook traffic
- Rotate if compromised

## Network Security

### Firewall Configuration

**Recommended Firewall Rules:**

```bash
# Allow SSH (restrict to known IPs if possible)
sudo ufw allow from YOUR_IP to any port 22

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (for Let's Encrypt, redirects to HTTPS)
sudo ufw allow 80/tcp

# Deny all other inbound traffic
sudo ufw default deny incoming

# Allow all outbound traffic
sudo ufw default allow outgoing

# Enable firewall
sudo ufw enable
```

### Database Security

**PostgreSQL Security:**

1. **Restrict Network Access**
   ```
   # pg_hba.conf - only allow local connections
   host    openalert    openalert    127.0.0.1/32    md5
   ```

2. **Disable Remote Connections** (if DB is on same host)
   ```
   # postgresql.conf
   listen_addresses = 'localhost'
   ```

3. **Use Strong Authentication**
   - Require password (md5 or scram-sha-256)
   - Consider certificate-based auth for extra security

4. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade postgresql-15
   ```

### Redis Security

**Redis Security:**

1. **Bind to Localhost Only** (if on same host)
   ```
   # redis.conf
   bind 127.0.0.1
   ```

2. **Require Password**
   ```
   # redis.conf
   requirepass your-strong-redis-password
   ```

3. **Disable Dangerous Commands**
   ```
   # redis.conf
   rename-command FLUSHALL ""
   rename-command FLUSHDB ""
   rename-command CONFIG ""
   ```

4. **Enable Protected Mode**
   ```
   # redis.conf
   protected-mode yes
   ```

## Data Protection

### Data Encryption

**Data in Transit:**
- All API traffic over HTTPS/TLS 1.2+
- Database connections over SSL/TLS
- Redis connections can use TLS (configure if needed)

**Data at Rest:**
- Database encryption (enable on managed services)
- Disk encryption (LUKS on Linux, BitLocker on Windows)
- Backup encryption (encrypt before uploading to S3/Azure)

### Sensitive Data Handling

**What's Sensitive:**
- Passwords (always hashed, never stored plain)
- JWT secrets
- API keys
- Integration keys
- User email addresses
- Phone numbers
- Notification content (may contain PII)

**Best Practices:**
- Hash passwords with bcrypt (cost factor 10+)
- Never log passwords or tokens
- Redact sensitive data in logs
- Mask phone numbers in UI (show last 4 digits)
- Encrypt backups containing sensitive data

### Personal Data (PII)

OpenAlert stores:
- User names
- Email addresses
- Phone numbers (for notifications)
- Alert content (may contain infrastructure details)

**User Rights (GDPR):**
- Right to access: `GET /users/:id` (own data)
- Right to deletion: Implement user deletion endpoint
- Right to export: Implement data export functionality

## Vulnerability Management

### Dependency Scanning

**Regular Security Audits:**

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Fix with breaking changes
npm audit fix --force
```

**Automated Scanning:**
- Enable GitHub Dependabot
- Use Snyk for continuous monitoring
- Set up automated PRs for dependency updates

### Security Updates

**Update Strategy:**
1. Monitor security advisories
2. Test updates in staging
3. Apply critical patches within 24-48 hours
4. Apply non-critical updates monthly

**Update Process:**
```bash
# Update all dependencies
npm update

# Check for outdated packages
npm outdated

# Update specific package
npm update package-name
```

### Penetration Testing

**Recommended Schedule:**
- Annual professional penetration test
- Quarterly internal security review
- Continuous automated scanning

**Focus Areas:**
- Authentication bypass
- Authorization flaws
- SQL injection
- XSS vulnerabilities
- CSRF attacks
- API abuse

## Incident Response

### Security Incident Response Plan

**If OpenAlert is Compromised:**

1. **Detect and Contain**
   - Monitor logs for suspicious activity
   - Check for unauthorized access attempts
   - Isolate affected systems

2. **Assess Scope**
   - Identify what data was accessed
   - Determine attack vector
   - List affected users

3. **Eradicate Threat**
   - Patch vulnerability
   - Rotate all secrets (JWT_SECRET, database passwords, API keys)
   - Force logout all users (invalidate all JWTs)

4. **Recover**
   - Restore from clean backup if needed
   - Re-deploy from known-good state
   - Verify system integrity

5. **Post-Incident**
   - Document incident
   - Notify affected users (if PII compromised)
   - Implement additional controls
   - Update incident response plan

### Rotating Secrets After Breach

**JWT Secret Rotation:**

1. Generate new JWT_SECRET
2. Update environment variable
3. Restart application
4. All existing tokens become invalid
5. Users must re-authenticate

**Database Password Rotation:**

```bash
# In PostgreSQL
ALTER USER openalert WITH PASSWORD 'new-secure-password';

# Update DATABASE_URL in .env
# Restart application
```

**Integration Key Rotation:**

```bash
# Via API
PATCH /integrations/:id/rotate-key
Authorization: Bearer {superadmin-token}

# Returns new integration key
# Update monitoring system with new URL
```

### Audit Logging

**Enable Audit Logging:**

OpenAlert includes correlation IDs in all logs:

```json
{
  "timestamp": "2024-02-03T10:30:00Z",
  "level": "info",
  "message": "User authenticated",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": 123,
  "action": "auth:login"
}
```

**Log Retention:**
- Production: 90 days minimum
- Compliance: 1+ year if required

**Review Logs For:**
- Failed login attempts (potential brute force)
- Authorization failures (potential privilege escalation)
- Unusual API usage patterns
- Database errors (potential SQL injection)

## Compliance

### GDPR Compliance

If serving EU users, OpenAlert must comply with GDPR:

**Required Features:**
1. **User Consent**: Obtain consent for data collection
2. **Data Access**: Users can request their data
3. **Data Portability**: Provide data export in JSON
4. **Data Deletion**: Delete user data on request
5. **Breach Notification**: Notify users within 72 hours of breach

**Implementation:**

```typescript
// Data export endpoint
@Get('users/:id/export')
@UseGuards(JwtAuthGuard)
async exportUserData(@Param('id') id: string, @CurrentUser() user) {
  // Verify user can only export own data
  if (user.id !== Number(id) && user.role !== 'superadmin') {
    throw new ForbiddenException();
  }
  return this.usersService.exportData(Number(id));
}

// Data deletion endpoint
@Delete('users/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRole('superadmin')
async deleteUser(@Param('id') id: string) {
  return this.usersService.deleteUserData(Number(id));
}
```

### Data Retention Policy

**Define Retention Periods:**

| Data Type | Retention Period | Rationale |
|-----------|------------------|-----------|
| User accounts | Until deletion requested | Account management |
| Incidents | 1 year | Historical analysis |
| Alerts | 90 days | Recent troubleshooting |
| Audit logs | 90 days (1 year for compliance) | Security review |
| Metrics | 30 days high-res, 1 year aggregated | Performance monitoring |

**Implement Automatic Cleanup:**

```typescript
// Cron job to delete old data
@Cron('0 0 * * *')  // Daily at midnight
async cleanupOldData() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await this.db.delete(alerts).where(lt(alerts.createdAt, ninetyDaysAgo));
}
```

## Security Best Practices

### Development

- [ ] Use parameterized queries (Drizzle ORM handles this)
- [ ] Validate all user input with class-validator
- [ ] Sanitize output to prevent XSS
- [ ] Use HTTPS in all environments (even dev)
- [ ] Never commit secrets to version control
- [ ] Review code for security issues before merge
- [ ] Use security linters (ESLint security plugins)

### Deployment

- [ ] Use strong, random secrets (JWT_SECRET, etc.)
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS restrictively
- [ ] Set appropriate rate limits
- [ ] Enable security headers (Helmet.js)
- [ ] Restrict database/Redis network access
- [ ] Use separate credentials per environment
- [ ] Enable audit logging

### Operations

- [ ] Monitor logs for suspicious activity
- [ ] Set up security alerts (failed logins, etc.)
- [ ] Keep dependencies updated
- [ ] Rotate secrets regularly
- [ ] Perform security audits
- [ ] Test backup restoration
- [ ] Maintain incident response plan
- [ ] Train team on security practices

### User Education

- [ ] Enforce strong password policy
- [ ] Encourage MFA when available
- [ ] Train users on phishing awareness
- [ ] Document password reset process
- [ ] Limit admin access (principle of least privilege)

## Security Checklist

Before going to production, verify:

- [ ] HTTPS enforced
- [ ] Strong JWT_SECRET configured
- [ ] Database password is strong and unique
- [ ] CORS configured with specific origins
- [ ] Rate limiting enabled
- [ ] Security headers enabled (Helmet.js)
- [ ] Database not publicly accessible
- [ ] Redis not publicly accessible
- [ ] Firewall rules configured
- [ ] Secrets not in version control
- [ ] npm audit shows no critical vulnerabilities
- [ ] Backups encrypted
- [ ] Audit logging enabled
- [ ] Incident response plan documented
- [ ] Security contact defined

## Reporting Security Issues

If you discover a security vulnerability in OpenAlert:

1. **Do NOT** open a public GitHub issue
2. Email security@openalert.example.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)
3. Allow 48 hours for initial response
4. Allow 90 days for fix before public disclosure

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/helmet)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
