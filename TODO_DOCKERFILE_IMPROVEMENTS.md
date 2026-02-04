# TODO: Dockerfile Improvements for Production

## Current State (Temporary Workarounds)

The Dockerfiles in `apps/api/Dockerfile` and `apps/web/Dockerfile` contain **temporary workarounds** to make Fly.io deployment work quickly. These work for testing but should be improved for production.

## What Needs to Be Fixed

### 1. Backend Dockerfile (`apps/api/Dockerfile`)

**Current Issues:**
- ⚠️ Uses `npm install` instead of `npm ci`
- ⚠️ Doesn't use `package-lock.json` for version locking
- ⚠️ Builds from app directory instead of monorepo root

**Why This Matters:**
- `npm install` can have version drift (less reliable)
- `npm ci` is faster and guarantees exact versions from lockfile
- Better for production reliability

**How to Fix:**
1. Create `apps/api/Dockerfile.production`
2. Build from monorepo root with proper context
3. Use `npm ci --workspace=apps/api`
4. Copy `package-lock.json` from root

**See:** `docs/deployment/DOCKERFILE_CHANGES_NOTES.md` for detailed instructions and production Dockerfile template

---

### 2. Frontend Dockerfile (`apps/web/Dockerfile`)

**Current Issues:**
- Same as backend - uses `npm install` instead of `npm ci`
- Builds from app directory instead of root

**How to Fix:**
- Same approach as backend
- Create `apps/web/Dockerfile.production`
- Build from monorepo root
- Use `npm ci --workspace=apps/web`

---

## When to Fix This

**Current Dockerfiles (NOW):**
- ✅ Good for: Testing, Fly.io deployment, quick VPS deployment
- ⚠️ Not ideal for: Production, CI/CD, multi-environment deployments

**Production Dockerfiles (LATER):**
- ✅ When: Before going to production
- ✅ When: Setting up CI/CD pipelines
- ✅ When: Need reproducible builds
- ✅ When: Deploying to Kubernetes/production environments

---

## Quick Fix Checklist

Before moving to production, complete these steps:

### Backend
- [ ] Create `apps/api/Dockerfile.production`
- [ ] Configure to build from monorepo root
- [ ] Use `npm ci` with lockfile
- [ ] Update deployment scripts to use production Dockerfile
- [ ] Test production build locally
- [ ] Update CI/CD to use production Dockerfile

### Frontend
- [ ] Create `apps/web/Dockerfile.production`
- [ ] Configure to build from monorepo root
- [ ] Use `npm ci` with lockfile
- [ ] Update deployment scripts
- [ ] Test production build
- [ ] Update CI/CD

### Documentation
- [ ] Update `FLY_IO_DEPLOYMENT.md` with production notes
- [ ] Update `ORACLE_CLOUD_DEPLOYMENT.md` with production notes
- [ ] Add deployment best practices guide
- [ ] Document the differences between dev and prod Dockerfiles

---

## Priority

**Priority Level:** 📊 **MEDIUM**

- **Urgent?** No - current Dockerfiles work fine for testing
- **Important?** Yes - should be done before production deployment
- **Timeline:** Before production launch or when setting up CI/CD

---

## References

- **Detailed Guide:** `docs/deployment/DOCKERFILE_CHANGES_NOTES.md`
- **Production Template:** See "File to Create for Production" section in above doc
- **Monorepo Best Practices:** https://docs.docker.com/build/building/multi-stage/

---

## Notes

Current Dockerfiles were created as **quick fixes** to get Fly.io deployment working. They:
- ✅ Work correctly for testing
- ✅ Deploy successfully
- ⚠️ Have technical debt that should be addressed later
- ⚠️ Don't follow production best practices

This is **intentional** - we prioritized "works now" over "perfect forever". Just remember to improve them before production! 🚀
