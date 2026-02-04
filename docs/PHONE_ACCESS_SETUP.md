# Phone Access Setup Guide

This document outlines the configuration changes made to enable access to the OpenAlert development environment from mobile devices on the same local network.

## Network Configuration Changes

### 1. Frontend - Vite Dev Server Configuration
**File**: `apps/web/vite.config.ts`

**Change**: Added server configuration to listen on all network interfaces (0.0.0.0) instead of just localhost.

```typescript
server: {
  host: true, // Listen on all network interfaces (0.0.0.0)
  port: 5175,
}
```

**Why**: By default, Vite only listens on localhost/loopback (127.0.0.1), which means only the host machine can access it. Setting `host: true` makes it listen on 0.0.0.0, allowing access from other devices on the network.

### 2. Frontend - API URL Configuration
**File**: `apps/web/.env.local`

**Change**: Set API URL to the host machine's network IP address.

```env
# Local network configuration
# Your PC's IP address: 192.168.0.60
VITE_API_URL=http://192.168.0.60:3001
```

**Why**: The frontend needs to know the network IP of the backend server to make API calls from a phone.

### 3. Backend - CORS Configuration
**File**: `apps/api/.env`

**Change**: Added network IP addresses to allowed CORS origins.

```env
ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5177,http://192.168.0.60:5175,http://192.168.0.60:5177
```

**Why**: CORS (Cross-Origin Resource Sharing) security prevents the browser from making requests to different origins. We need to explicitly allow requests from the network IP.

**Note**: The backend (NestJS with Fastify) already listens on 0.0.0.0:3001 by default, so no code changes were needed.

## Bugs Fixed During Phone Access Setup

While setting up phone access, several existing bugs were discovered and fixed:

### 1. Database Credentials Fix
**File**: `apps/api/.env`

**Issue**: Database connection was using incorrect credentials (postgres/postgres instead of openalert/openalert_dev).

**Fix**: Updated DATABASE_URL to match credentials from docker-compose.yml.

```env
DATABASE_URL=postgresql://openalert:openalert_dev@localhost:5432/openalert
```

**Severity**: CRITICAL - Backend couldn't connect to database at all.

**Phone-specific?**: NO - This was a general bug that would have affected any deployment.

### 2. Password Hash Corruption
**File**: `apps/api/fix-passwords.js` (temporary script, not committed)

**Issue**: Password hashes in the database didn't match "password123". When updating via SQL, PostgreSQL was escaping `$` signs in bcrypt hashes (e.g., `$2b$10$...` became `\$2b\$10$...`), causing authentication to fail.

**Fix**: Created Node.js script to properly generate and insert bcrypt hashes using the bcrypt library.

```javascript
const hash = await bcrypt.hash('password123', 10);
await pool.query(
  `UPDATE users SET password_hash = $1 WHERE email IN (...)`,
  [hash]  // Using parameterized query to prevent escaping issues
);
```

**Severity**: CRITICAL - All local authentication was broken.

**Phone-specific?**: NO - This affected login from any device, including the development machine.

### 3. Missing Role Field in JWT/Profile
**Files**:
- `apps/api/src/modules/auth/local-auth.service.ts`
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts`

**Issue**: JWT payload and profile endpoint didn't include the user's `role` field, causing frontend permission checks to fail. Users could login but only see "Dashboard" in the sidebar.

**Fix**: Added `role` to JWT payload generation and JWT validation.

```typescript
// local-auth.service.ts
const accessToken = this.jwtService.sign(
  { sub: user.id, email: user.email, name: user.name, role: user.role },
  { expiresIn: this.config.get('JWT_EXPIRES_IN') || '7d' },
);

// jwt.strategy.ts
return {
  id: user.id,
  email: user.email,
  name: user.name,
  externalId: user.externalId,
  role: user.role,  // Added
};
```

**Severity**: HIGH - Role-based access control (RBAC) was completely broken.

**Phone-specific?**: NO - This affected the sidebar permissions on any device.

## How to Find Your Network IP Address

### Windows
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet).

### macOS/Linux
```bash
ifconfig
# or
ip addr show
```

## Testing Phone Access

1. Ensure both frontend and backend servers are running:
   ```bash
   # Terminal 1 - Backend
   cd apps/api
   npm run start:dev

   # Terminal 2 - Frontend
   cd apps/web
   npm run dev
   ```

2. Note the ports:
   - Frontend: Port shown in terminal (e.g., 5177)
   - Backend: 3001

3. On your phone's browser, navigate to:
   ```
   http://[YOUR_IP]:5177
   ```
   Example: `http://192.168.0.60:5177`

4. Test login with:
   - alice@example.com / password123 (superadmin)
   - test@openalert.com / password123 (responder)

## Security Considerations

⚠️ **Development Only**: These configurations are for local development only. Do NOT use in production.

- The dev servers are exposed to your local network
- Ensure you trust all devices on your network
- Use a VPN if accessing over untrusted networks
- In production, use proper SSL/TLS, secure origins, and firewall rules

## Summary

### Phone-Specific Changes (Required for Phone Access)
- Vite server `host: true` configuration
- Frontend `.env.local` with network IP
- Backend CORS origins with network IP

### General Bugs Fixed (Not Phone-Specific)
- Database credentials correction
- Password hash corruption fix
- Missing role field in JWT/profile endpoint

**Conclusion**: Only the network configuration changes were specifically needed for phone access. The other three fixes were critical bugs that needed to be resolved regardless of the access method.
