# Environment Variables

Complete guide to configuring OpenAlert with environment variables.

## Backend (apps/api)

Create `apps/api/.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://openalert:openalert@localhost:5432/openalert

# Redis
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your-cookie-secret-key

# Azure Entra ID (SSO)
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_REDIRECT_URI=http://localhost:3001/auth/callback

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:5173

# SendGrid (Email Notifications)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=OpenAlert

# Optional: Twilio (SMS/Voice Notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_PHONE=+1234567890

# Optional: Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret

# Optional: Microsoft Teams Integration
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/your-webhook

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=60

# Logging
LOG_LEVEL=info
```

## Frontend (apps/web)

Create `apps/web/.env` file:

```env
# API Configuration
VITE_API_URL=http://localhost:3001
```

## Production Environment Variables

### Backend Production (.env.production)

```env
NODE_ENV=production
PORT=3001

# Use production database
DATABASE_URL=postgresql://user:password@prod-db-host:5432/openalert

# Use production Redis (e.g., AWS ElastiCache, Azure Cache for Redis)
REDIS_URL=redis://prod-redis-host:6379

# Strong secrets
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=7d
COOKIE_SECRET=<generate-strong-secret>

# Production Azure AD
AZURE_CLIENT_ID=<production-azure-client-id>
AZURE_CLIENT_SECRET=<production-azure-client-secret>
AZURE_TENANT_ID=<production-azure-tenant-id>
AZURE_REDIRECT_URI=https://api.yourdomain.com/auth/callback

# Production URLs
ALLOWED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Production SendGrid
SENDGRID_API_KEY=<production-sendgrid-key>
SENDGRID_FROM_EMAIL=alerts@yourdomain.com
SENDGRID_FROM_NAME=OpenAlert

# Production rate limiting (more strict)
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# Production logging
LOG_LEVEL=warn
```

### Frontend Production

```env
VITE_API_URL=https://api.yourdomain.com
```

## Docker Compose Environment

The `docker/docker-compose.yml` file uses these environment variables:

```yaml
# PostgreSQL
POSTGRES_USER=openalert
POSTGRES_PASSWORD=openalert
POSTGRES_DB=openalert

# Redis (no auth by default)
```

## Environment Variable Descriptions

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for signing JWTs | Random 32+ char string |

### Optional Azure AD Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `AZURE_CLIENT_ID` | Azure AD application ID | SSO Login |
| `AZURE_CLIENT_SECRET` | Azure AD client secret | SSO Login |
| `AZURE_TENANT_ID` | Azure AD tenant ID | SSO Login |
| `AZURE_REDIRECT_URI` | OAuth callback URL | SSO Login |

### Optional Notification Variables

| Variable | Description | Service |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key | Email |
| `SENDGRID_FROM_EMAIL` | Sender email address | Email |
| `SENDGRID_FROM_NAME` | Sender name | Email |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | SMS/Voice |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | SMS/Voice |
| `TWILIO_FROM_PHONE` | Twilio phone number | SMS/Voice |
| `SLACK_BOT_TOKEN` | Slack bot OAuth token | Slack |
| `TEAMS_WEBHOOK_URL` | Teams webhook URL | Microsoft Teams |

## Generating Secrets

### JWT_SECRET and COOKIE_SECRET

```bash
# Generate a strong random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Azure AD Setup

1. Go to Azure Portal → Azure Active Directory
2. Register a new application
3. Add redirect URI: `http://localhost:3001/auth/callback`
4. Generate a client secret
5. Copy Client ID, Tenant ID, and Secret

### SendGrid Setup

1. Sign up at https://sendgrid.com
2. Create API key with "Mail Send" permissions
3. Verify sender email address
4. Copy API key to `SENDGRID_API_KEY`

## Development vs Production

### Development
- Uses local PostgreSQL and Redis (Docker Compose)
- Less strict rate limiting
- Detailed logging (LOG_LEVEL=info)
- Dev token endpoint enabled
- Relaxed CORS policy

### Production
- Managed database and cache services
- Strict rate limiting
- Minimal logging (LOG_LEVEL=warn)
- Dev token endpoint disabled (NODE_ENV=production)
- Strict CORS policy
- HTTPS only
- Strong secrets
- Security headers enabled (Helmet)

## Security Best Practices

1. **Never commit .env files** - Add to .gitignore
2. **Use different secrets** for each environment
3. **Rotate secrets regularly** - Especially in production
4. **Use managed secrets** - AWS Secrets Manager, Azure Key Vault, etc.
5. **Limit CORS origins** - Only allow your frontend domain
6. **Use HTTPS** in production
7. **Strong database passwords** - Random, 20+ characters
8. **Principle of least privilege** - Database users should only have necessary permissions

## Validation

The backend validates required environment variables on startup:

```
✓ DATABASE_URL is set
✓ REDIS_URL is set
✓ JWT_SECRET is set
⚠ AZURE_CLIENT_ID not set - SSO will not work
⚠ SENDGRID_API_KEY not set - Email notifications will fail
```

## Troubleshooting

### "Azure Entra ID not configured"
- Set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- Or use dev token endpoint: `/auth/dev-token/:userId`

### "SendGrid API key not configured"
- Set `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
- Email notifications will be skipped if not configured

### Database connection failed
- Check `DATABASE_URL` format
- Ensure PostgreSQL is running
- Check firewall rules
- Verify credentials

### Redis connection failed
- Check `REDIS_URL` format
- Ensure Redis is running
- Check firewall rules
- For production, ensure TLS is configured if required

## Example .env Files

### Minimal Development Setup

```env
DATABASE_URL=postgresql://openalert:openalert@localhost:5432/openalert
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
FRONTEND_URL=http://localhost:5173
```

### Full Development Setup

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://openalert:openalert@localhost:5432/openalert
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=7d
COOKIE_SECRET=dev-cookie-secret
AZURE_CLIENT_ID=your-dev-azure-client-id
AZURE_CLIENT_SECRET=your-dev-azure-client-secret
AZURE_TENANT_ID=your-dev-azure-tenant-id
AZURE_REDIRECT_URI=http://localhost:3001/auth/callback
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:5173
SENDGRID_API_KEY=your-dev-sendgrid-key
SENDGRID_FROM_EMAIL=dev@yourdomain.com
SENDGRID_FROM_NAME=OpenAlert Dev
LOG_LEVEL=debug
```

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [apps/api/README.md](../apps/api/README.md) - Backend setup guide
- [apps/web/README.md](../apps/web/README.md) - Frontend setup guide
