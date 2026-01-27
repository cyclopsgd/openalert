# Implementing Azure Entra ID authentication in Node.js/Express

For your enterprise incident management platform, **MSAL Node.js** (`@azure/msal-node`) combined with **Express middleware patterns** provides the most robust, production-ready SSO implementation. Microsoft has deprecated passport-azure-ad (archived August 2023), making MSAL the recommended path forward. This guide covers complete authentication flows, session management, JWT validation, multi-tenancy, and security best practices with working code examples.

## MSAL Node.js provides the foundation for enterprise SSO

Microsoft Authentication Library for Node.js (version **3.8.5** as of January 2025) supports all critical authentication scenarios: Authorization Code flow with PKCE, Client Credentials for daemon apps, and On-Behalf-Of for API chains. The library handles token caching, refresh, and validation internally while exposing hooks for enterprise customization.

**Core configuration for a confidential client application:**

```typescript
import * as msal from "@azure/msal-node";

const msalConfig: msal.Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    // Production: Use certificates instead of secrets
    // clientCertificate: {
    //   thumbprintSha256: process.env.CERT_THUMBPRINT_SHA256,
    //   privateKey: process.env.CERT_PRIVATE_KEY,
    // },
  },
  cache: {
    cachePlugin: redisCachePlugin  // Required for production—see caching section
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) console.log(`[MSAL] ${message}`);
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === "production" 
        ? msal.LogLevel.Warning 
        : msal.LogLevel.Info
    }
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);
const cryptoProvider = new msal.CryptoProvider();
```

Use **ConfidentialClientApplication** for server-side web apps where secrets can be securely stored. The authority URL determines who can sign in—single-tenant (`/{tenant-id}`) restricts access to one organization, while `/organizations` enables multi-tenant SaaS scenarios.

## Authorization code flow with PKCE secures the sign-in process

Even for confidential clients, PKCE (Proof Key for Code Exchange) provides defense against authorization code interception attacks. MSAL generates the code verifier and challenge cryptographically:

```typescript
import express from "express";
import session from "express-session";

const app = express();

// Session middleware configuration—see session section for full setup
app.use(session({ /* ... */ }));

// Store PKCE codes per session
interface PkceStore {
  [sessionId: string]: { verifier: string; challenge: string };
}
const pkceStore: PkceStore = {};

// Step 1: Initiate login with PKCE
app.get("/auth/login", async (req, res) => {
  const sessionId = req.sessionID;
  
  // Generate cryptographic PKCE codes
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  pkceStore[sessionId] = { verifier, challenge };
  
  const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
    scopes: ["openid", "profile", "email", "User.Read", "offline_access"],
    redirectUri: `${process.env.APP_URL}/auth/callback`,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    state: sessionId,  // CSRF protection
    prompt: "select_account"
  };
  
  try {
    const authUrl = await cca.getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(authUrl);
  } catch (error) {
    console.error("Auth URL generation failed:", error);
    res.redirect("/error?message=auth_init_failed");
  }
});

// Step 2: Handle callback and exchange code for tokens
app.get("/auth/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;
  
  // Handle Azure AD errors
  if (error) {
    console.error(`Auth error: ${error} - ${error_description}`);
    return res.redirect(`/error?message=${encodeURIComponent(error_description as string)}`);
  }
  
  // Validate state parameter (CSRF protection)
  if (state !== req.sessionID) {
    console.error("State mismatch - potential CSRF attack");
    return res.status(403).send("Invalid state parameter");
  }
  
  const pkceCodes = pkceStore[state as string];
  if (!pkceCodes) {
    return res.status(400).send("PKCE verifier not found");
  }
  
  const tokenRequest: msal.AuthorizationCodeRequest = {
    code: code as string,
    scopes: ["openid", "profile", "email", "User.Read", "offline_access"],
    redirectUri: `${process.env.APP_URL}/auth/callback`,
    codeVerifier: pkceCodes.verifier
  };
  
  try {
    const response = await cca.acquireTokenByCode(tokenRequest);
    
    // Store account for silent token acquisition
    req.session.account = response.account;
    req.session.homeAccountId = response.account?.homeAccountId;
    req.session.isAuthenticated = true;
    
    // Extract user info for application use
    req.session.user = {
      oid: response.account?.localAccountId,
      name: response.account?.name,
      email: response.account?.username,
      tenantId: response.account?.tenantId,
      roles: response.idTokenClaims?.roles || [],
      groups: response.idTokenClaims?.groups || []
    };
    
    // Cleanup PKCE store
    delete pkceStore[state as string];
    
    // Regenerate session to prevent fixation attacks
    const userData = req.session.user;
    const accountData = req.session.account;
    req.session.regenerate((err) => {
      if (err) console.error("Session regeneration error:", err);
      req.session.user = userData;
      req.session.account = accountData;
      req.session.isAuthenticated = true;
      res.redirect(req.session.returnTo || "/dashboard");
    });
    
  } catch (error) {
    console.error("Token acquisition failed:", error);
    delete pkceStore[state as string];
    res.redirect("/error?message=token_acquisition_failed");
  }
});
```

The `offline_access` scope is critical—it grants refresh tokens for silent renewal. Without it, users must re-authenticate when access tokens expire (typically after **1 hour**).

## Silent token renewal keeps users authenticated seamlessly

MSAL manages refresh tokens internally through `acquireTokenSilent()`. This method checks the cache first, refreshes expired tokens automatically, and only fails when user interaction is truly required:

```typescript
async function getAccessToken(
  req: express.Request,
  scopes: string[]
): Promise<string> {
  if (!req.session.account) {
    throw new Error("No account in session - authentication required");
  }
  
  const silentRequest: msal.SilentFlowRequest = {
    account: req.session.account,
    scopes: scopes,
    forceRefresh: false  // Only refresh when needed
  };
  
  try {
    const response = await cca.acquireTokenSilent(silentRequest);
    
    // Update account if changed during refresh
    if (response.account) {
      req.session.account = response.account;
    }
    
    return response.accessToken;
    
  } catch (error) {
    if (error instanceof msal.InteractionRequiredAuthError) {
      // Token cannot be refreshed silently
      req.session.returnTo = req.originalUrl;
      throw { 
        type: "interaction_required", 
        redirectUrl: "/auth/login" 
      };
    }
    throw error;
  }
}

// Middleware for ensuring fresh tokens
const ensureFreshToken = (scopes: string[]) => {
  return async (
    req: express.Request, 
    res: express.Response, 
    next: express.NextFunction
  ) => {
    try {
      req.accessToken = await getAccessToken(req, scopes);
      next();
    } catch (error: any) {
      if (error.type === "interaction_required") {
        return res.redirect(error.redirectUrl);
      }
      next(error);
    }
  };
};
```

## Production session management requires Redis and secure cookies

In-memory sessions don't scale across multiple server instances and lose data on restart. Redis provides distributed session storage essential for enterprise deployments:

```typescript
import session from "express-session";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";

// Initialize Redis with production settings
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.NODE_ENV === "production",
    rejectUnauthorized: true
  },
  password: process.env.REDIS_PASSWORD
});

redisClient.connect().catch(console.error);
redisClient.on("error", (err) => console.error("Redis error:", err));

// Session configuration with security hardening
app.use(session({
  store: new RedisStore({
    client: redisClient,
    prefix: "incident-mgmt:sess:",
    ttl: 86400  // 24 hours
  }),
  secret: process.env.SESSION_SECRET!,  // Minimum 32 random characters
  name: "sessionId",                     // Don't use default "connect.sid"
  resave: false,
  saveUninitialized: false,
  rolling: true,                         // Reset expiry on activity
  proxy: true,                           // Trust reverse proxy
  cookie: {
    secure: process.env.NODE_ENV === "production",  // HTTPS only
    httpOnly: true,                      // Prevent XSS access
    sameSite: "lax",                     // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,         // 24 hours
    domain: process.env.COOKIE_DOMAIN
  }
}));

// Trust proxy when behind load balancer
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
```

**Critical cookie settings**: `httpOnly: true` prevents JavaScript access (XSS mitigation), `secure: true` ensures transmission only over HTTPS, and `sameSite: "lax"` provides CSRF protection while allowing normal navigation.

## MSAL token cache must be distributed for web applications

MSAL's default in-memory cache doesn't persist across restarts or scale across instances. Implement a Redis-backed cache plugin:

```typescript
import { ICachePlugin, TokenCacheContext } from "@azure/msal-node";

class RedisMsalCachePlugin implements ICachePlugin {
  private client: typeof redisClient;
  private keyPrefix: string;
  private ttl: number;
  
  constructor(redisClient: typeof redisClient, keyPrefix = "msal:", ttl = 86400) {
    this.client = redisClient;
    this.keyPrefix = keyPrefix;
    this.ttl = ttl;
  }
  
  async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
    const key = `${this.keyPrefix}${context.cacheHasChanged}`;
    try {
      const cachedData = await this.client.get(key);
      if (cachedData) {
        context.tokenCache.deserialize(cachedData);
      }
    } catch (error) {
      console.error("Cache read error:", error);
    }
  }
  
  async afterCacheAccess(context: TokenCacheContext): Promise<void> {
    if (context.cacheHasChanged) {
      const key = `${this.keyPrefix}cache`;
      try {
        await this.client.setEx(
          key, 
          this.ttl, 
          context.tokenCache.serialize()
        );
      } catch (error) {
        console.error("Cache write error:", error);
      }
    }
  }
}

// Use with MSAL configuration
const redisCachePlugin = new RedisMsalCachePlugin(redisClient);
```

For user-specific caching in multi-user scenarios, partition by `homeAccountId`:

```typescript
// Per-user cache for web apps serving multiple users
function createUserCachePlugin(homeAccountId: string): ICachePlugin {
  const cacheKey = `msal:user:${homeAccountId}`;
  return new RedisMsalCachePlugin(redisClient, cacheKey);
}
```

## JWT validation middleware protects API endpoints

For API routes that receive Bearer tokens (from SPAs or other services), validate tokens using the `jose` library with automatic JWKS caching:

```typescript
import * as jose from "jose";

const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

// JWKS client with automatic caching
const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URI), {
  cacheMaxAge: 600000,     // Cache keys for 10 minutes
  cooldownDuration: 30000  // Minimum 30s between fetches
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        oid: string;
        sub: string;
        name?: string;
        email?: string;
        roles: string[];
        scopes: string[];
        tenantId: string;
      };
      accessToken?: string;
    }
  }
}

// JWT validation middleware
export const validateJwt = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ 
      error: "unauthorized", 
      message: "Bearer token required" 
    });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: CLIENT_ID,
      algorithms: ["RS256"],
      clockTolerance: 60  // Allow 60s clock skew
    });
    
    req.user = {
      oid: payload.oid as string,
      sub: payload.sub as string,
      name: payload.name as string,
      email: (payload.preferred_username || payload.email) as string,
      roles: (payload.roles as string[]) || [],
      scopes: payload.scp ? (payload.scp as string).split(" ") : [],
      tenantId: payload.tid as string
    };
    
    next();
    
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      res.status(401).json({ error: "token_expired" });
      return;
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      res.status(401).json({ error: "invalid_claims" });
      return;
    }
    res.status(401).json({ error: "invalid_token" });
  }
};
```

## Role-based access control middleware enforces authorization

Azure Entra ID supports **App Roles** (recommended) and **Security Groups** for authorization. App Roles appear in the `roles` claim and don't suffer from the group overage problem that occurs when users belong to more than **200 groups**:

```typescript
// Role-based authorization
export const requireRoles = (...allowedRoles: string[]) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "authentication_required" });
      return;
    }
    
    const hasRole = allowedRoles.some(role => req.user!.roles.includes(role));
    
    if (!hasRole) {
      res.status(403).json({
        error: "forbidden",
        message: `Required role: ${allowedRoles.join(" or ")}`
      });
      return;
    }
    
    next();
  };
};

// Scope-based authorization for APIs
export const requireScopes = (...requiredScopes: string[]) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "authentication_required" });
      return;
    }
    
    const hasAllScopes = requiredScopes.every(
      scope => req.user!.scopes.includes(scope)
    );
    
    if (!hasAllScopes) {
      res.status(403).json({
        error: "insufficient_scope",
        message: `Required scopes: ${requiredScopes.join(", ")}`
      });
      return;
    }
    
    next();
  };
};

// Usage in routes
app.get("/api/incidents", 
  validateJwt,
  requireScopes("Incidents.Read"),
  (req, res) => {
    // Handle request
  }
);

app.delete("/api/incidents/:id",
  validateJwt,
  requireRoles("Admin", "IncidentManager"),
  requireScopes("Incidents.Delete"),
  (req, res) => {
    // Handle deletion
  }
);
```

Configure App Roles in your Azure App Registration manifest:

```json
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "displayName": "Incident Manager",
      "id": "unique-guid-here",
      "isEnabled": true,
      "value": "IncidentManager"
    },
    {
      "allowedMemberTypes": ["User"],
      "displayName": "Admin",
      "id": "another-unique-guid",
      "isEnabled": true,
      "value": "Admin"
    }
  ]
}
```

## Multi-tenant configuration requires tenant validation

For SaaS applications serving multiple organizations, use the `/organizations` authority and validate incoming tenant IDs:

```typescript
// Multi-tenant MSAL configuration
const multiTenantConfig: msal.Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: "https://login.microsoftonline.com/organizations",
    clientSecret: process.env.AZURE_CLIENT_SECRET
  }
};

// Tenant validation middleware
const ALLOWED_TENANTS = new Set([
  process.env.ALLOWED_TENANT_1,
  process.env.ALLOWED_TENANT_2,
  // Load from database in production
]);

export const validateTenant = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const tenantId = req.user?.tenantId || req.session?.user?.tenantId;
  
  if (!tenantId) {
    res.status(401).json({ error: "tenant_id_missing" });
    return;
  }
  
  if (!ALLOWED_TENANTS.has(tenantId)) {
    console.warn(`Unauthorized tenant access attempt: ${tenantId}`);
    res.status(403).json({
      error: "tenant_not_authorized",
      message: "Your organization is not authorized to use this application"
    });
    return;
  }
  
  req.tenantId = tenantId;
  next();
};
```

**Authority URL reference:**

| Scenario | Authority URL |
|----------|--------------|
| Single-tenant | `https://login.microsoftonline.com/{tenant-id}` |
| Multi-tenant (work/school) | `https://login.microsoftonline.com/organizations` |
| Multi-tenant + personal | `https://login.microsoftonline.com/common` |
| Personal accounts only | `https://login.microsoftonline.com/consumers` |

## Logout must clear both local and Azure AD sessions

Proper logout requires destroying the local session and redirecting to Azure AD's logout endpoint:

```typescript
app.get("/auth/logout", async (req, res) => {
  const account = req.session?.account;
  const tenantId = account?.tenantId || "common";
  const postLogoutUri = `${process.env.APP_URL}/`;
  
  // Clear MSAL token cache for this user
  if (account?.homeAccountId) {
    const tokenCache = cca.getTokenCache();
    const accountToRemove = await tokenCache.getAccountByHomeId(
      account.homeAccountId
    );
    if (accountToRemove) {
      await tokenCache.removeAccount(accountToRemove);
    }
  }
  
  // Destroy local session
  req.session.destroy((err) => {
    if (err) console.error("Session destruction error:", err);
    
    // Clear session cookie
    res.clearCookie("sessionId", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    });
    
    // Redirect to Azure AD logout
    const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutUri)}`;
    res.redirect(logoutUrl);
  });
});

// Front-channel logout endpoint (register in Azure Portal)
app.get("/auth/frontchannel-logout", (req, res) => {
  const { sid } = req.query;  // Session ID from Azure AD
  console.log(`Front-channel logout received: ${sid}`);
  
  // In production, look up and destroy the specific session
  // This enables SSO logout across applications
  
  res.status(200).send("OK");
});
```

Register the front-channel logout URL in Azure Portal → App Registration → Authentication → Front-channel logout URL.

## Error handling must cover all AADSTS error codes

Azure AD returns specific error codes that require different handling strategies:

```typescript
const ERROR_CATEGORIES = {
  INTERACTION_REQUIRED: [
    "AADSTS50076",  // MFA required
    "AADSTS50079",  // MFA enrollment needed
    "AADSTS65001",  // Consent required
    "AADSTS50058"   // Silent sign-in failed
  ],
  INVALID_GRANT: [
    "AADSTS70008",   // Expired refresh token
    "AADSTS700082",  // Refresh token expired (inactivity)
    "AADSTS50173"    // Grant revoked
  ],
  CONFIGURATION: [
    "AADSTS50011",   // Invalid redirect URI
    "AADSTS700016",  // App not found
    "AADSTS7000218"  // Missing client credentials
  ]
};

export const authErrorHandler = (
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const errorMessage = err.errorMessage || err.message || "";
  
  // Check for interaction required errors
  if (ERROR_CATEGORIES.INTERACTION_REQUIRED.some(code => 
    errorMessage.includes(code)
  )) {
    req.session.returnTo = req.originalUrl;
    res.status(401).json({
      error: "interaction_required",
      message: "Re-authentication required",
      redirectUrl: "/auth/login"
    });
    return;
  }
  
  // Check for invalid grant (session expired)
  if (ERROR_CATEGORIES.INVALID_GRANT.some(code => 
    errorMessage.includes(code)
  )) {
    delete req.session.account;
    res.status(401).json({
      error: "session_expired",
      message: "Your session has expired",
      redirectUrl: "/auth/login"
    });
    return;
  }
  
  // Configuration errors - log for admin attention
  if (ERROR_CATEGORIES.CONFIGURATION.some(code => 
    errorMessage.includes(code)
  )) {
    console.error("Configuration error:", errorMessage);
    res.status(500).json({
      error: "configuration_error",
      message: "Authentication service misconfigured"
    });
    return;
  }
  
  // Unknown error
  console.error("Unhandled auth error:", err);
  res.status(500).json({ error: "authentication_error" });
};

app.use(authErrorHandler);
```

## Azure Portal app registration checklist

Configure your App Registration with these settings for production:

1. **Authentication → Platform: Web**
   - Redirect URI: `https://your-app.com/auth/callback`
   - Front-channel logout URL: `https://your-app.com/auth/frontchannel-logout`
   - ID tokens: ✓ (for OpenID Connect)
   - Access tokens: ✓ (if calling APIs)

2. **Certificates & secrets**
   - Production: Upload certificate (recommended)
   - Development: Client secret (max 24 months)

3. **API permissions**
   - `openid`, `profile`, `email` (delegated)
   - `User.Read` (delegated) for Microsoft Graph profile
   - Custom API scopes as needed

4. **Token configuration → Add groups claim**
   - Select "Groups assigned to the application" to avoid overage
   - Or use App Roles instead (recommended)

5. **App roles** (manifest)
   - Define application-specific roles for RBAC

## Conclusion

This implementation provides a complete, production-ready authentication foundation for your incident management platform. The key architectural decisions are: **MSAL over passport-azure-ad** for active support and modern patterns, **Redis-backed sessions and token cache** for horizontal scaling, **PKCE for all auth flows** even with confidential clients, **App Roles over Security Groups** for cleaner authorization, and **comprehensive error handling** covering Azure AD's error taxonomy.

The code examples are designed for direct integration—configure your environment variables, register your app in Azure Portal, and the authentication layer is ready for your incident management business logic. For multi-tenant SaaS deployment, add tenant validation middleware and consider implementing a tenant onboarding flow that provisions database schemas and captures billing information during first sign-in.