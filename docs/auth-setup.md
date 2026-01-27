# Authentication Setup Guide

OpenAlert uses **Azure Entra ID** (formerly Azure AD) for authentication via OAuth 2.0 / OpenID Connect.

## Azure Entra ID Configuration

### 1. Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in the details:
   - **Name**: OpenAlert
   - **Supported account types**: Choose based on your needs
     - Single tenant (recommended for internal use)
     - Multitenant (for SaaS)
   - **Redirect URI**:
     - Type: Web
     - URI: `http://localhost:3001/auth/callback` (dev)
     - Production: `https://your-domain.com/auth/callback`

4. Click **Register**

### 2. Configure Application

#### API Permissions
1. Go to **API permissions**
2. Add the following Microsoft Graph permissions:
   - `User.Read` (Delegated) - Read user profile
   - `openid` (Delegated) - Sign in
   - `profile` (Delegated) - View basic profile
   - `email` (Delegated) - View email address
3. Click **Grant admin consent** (if you're an admin)

#### Certificates & Secrets
1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description: "OpenAlert API"
4. Choose expiration period
5. Click **Add**
6. **Copy the secret value immediately** - you won't be able to see it again!

#### Authentication
1. Go to **Authentication**
2. Under **Platform configurations** → Web:
   - Add redirect URIs for each environment
   - Enable **ID tokens** (used for OpenID Connect)
3. Set **Front-channel logout URL** if needed
4. Save changes

### 3. Get Required Values

You'll need these values for your `.env` file:

- **Tenant ID**: Found on the app overview page (Directory/tenant ID)
- **Client ID**: Found on the app overview page (Application/client ID)
- **Client Secret**: The value you copied when creating the secret

## Environment Variables

Update your `.env` file:

```bash
# Azure Entra ID
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here

# JWT Configuration
JWT_SECRET=your-secure-random-secret-at-least-32-characters-long

# Application URLs
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

## Authentication Flow

### Production Flow (with Azure AD)

1. User visits frontend → clicks "Sign in with Microsoft"
2. Frontend redirects to `/auth/login`
3. Backend generates Azure AD authorization URL and redirects user
4. User authenticates with Microsoft
5. Azure redirects to `/auth/callback` with authorization code
6. Backend exchanges code for tokens
7. Backend provisions/updates user in database
8. Backend generates JWT token for API access
9. Backend redirects to frontend with JWT token
10. Frontend stores token and uses it for API calls

### Development Flow (without Azure AD)

For local development without configuring Azure AD:

1. Use the dev token endpoint to generate a test token:
```bash
# Get token for user ID 1 (Alice)
curl http://localhost:3001/auth/dev-token/1

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

2. Use the token in API requests:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/incidents
```

**Note**: Dev tokens are only available in development mode (`NODE_ENV != production`)

## Testing Authentication

### 1. Get User Profile
```bash
# With dev token
TOKEN=$(curl -s http://localhost:3001/auth/dev-token/1 | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/auth/profile
```

### 2. Test Protected Endpoints
```bash
# List incidents (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/incidents

# Acknowledge incident (requires auth)
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3001/incidents/1/acknowledge
```

### 3. Test Without Token (should fail)
```bash
curl http://localhost:3001/incidents
# Response: 401 Unauthorized
```

## User Provisioning

Users are automatically provisioned on first login:
1. User authenticates via Azure AD
2. Backend extracts user info from token
3. If user doesn't exist, creates new user record
4. If user exists, updates email/name if changed
5. Returns JWT token for API access

User data stored:
- `external_id`: Azure AD object ID (oid claim)
- `email`: User's email address
- `name`: User's display name
- `is_active`: Default true, can be set to false to disable access

## JWT Token Structure

```json
{
  "sub": "1",              // User ID in our database
  "email": "user@example.com",
  "name": "John Doe",
  "oid": "azure-ad-object-id",
  "iat": 1234567890,
  "exp": 1234567890
}
```

Tokens expire after 7 days by default.

## Security Considerations

### Production Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Set strong `JWT_SECRET` (min 32 characters, random)
- [ ] Rotate client secrets periodically
- [ ] Enable Azure AD MFA for users
- [ ] Set appropriate token expiration
- [ ] Implement token refresh mechanism
- [ ] Monitor failed authentication attempts
- [ ] Set up proper CORS configuration
- [ ] Use environment-specific redirect URIs
- [ ] Disable dev token endpoint in production

### JWT Secret Generation

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Troubleshooting

### "Invalid client secret"
- Verify `AZURE_CLIENT_SECRET` matches the value from Azure Portal
- Check if secret has expired (recreate if needed)

### "Redirect URI mismatch"
- Ensure redirect URI in `.env` matches Azure Portal configuration exactly
- Check for trailing slashes
- Verify protocol (http vs https)

### "Token validation failed"
- Check `JWT_SECRET` is set correctly
- Verify token hasn't expired
- Ensure Authorization header format: `Bearer <token>`

### "User not found or inactive"
- Check user exists in database
- Verify `is_active` is true
- Check user was properly provisioned on login

## Multi-Tenancy

For SaaS applications supporting multiple organizations:

1. Register as **Multitenant** application
2. Use `common` as tenant ID in authority URL
3. Extract tenant ID from token claims
4. Map users to organizations in your database
5. Implement organization-based access control

## Next Steps

- Configure frontend OAuth flow
- Implement token refresh
- Add role-based access control (RBAC)
- Set up API rate limiting per user
- Implement audit logging for auth events
