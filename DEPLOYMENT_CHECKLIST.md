# Quick Deployment Checklist

## Files Created for Production Deployment

✅ **Docker Configuration:**
- [ ] `apps/server/Dockerfile` - Multi-stage production build for Express API
- [ ] `apps/web/Dockerfile` - Multi-stage production build for Next.js
- [ ] `docker-compose.prod.yml` - Production orchestration with health checks
- [ ] `.env.production.example` - Template for production environment variables

✅ **Demo & Seeding:**
- [ ] `apps/server/seed-demo.ts` - Populate demo data (5 members, loans, contributions)
- [ ] `scripts/reset-demo.sh` - Automated daily reset script
- [ ] `scripts/crontab.example` - Cron schedule for auto-reset

✅ **Security:**
- [ ] `apps/server/src/server.security.ts` - Rate limiting, helmet, CORS hardening
- [ ] Production CORS limited to equiyield.sanchez.ph
- [ ] Rate limiting: 100 req/15min (200 in demo mode)
- [ ] Auth endpoint: 10 attempts/15min

✅ **UI:**
- [ ] `apps/web/components/DemoBanner.tsx` - Demo mode indicator
- [ ] `apps/web/app/layout.demo.tsx` - Layout with demo banner

✅ **Documentation:**
- [ ] `DEPLOYMENT.md` - Complete OCI + Portainer + NPM setup guide
- [ ] README updated with deployment notes
- [ ] ADMIN_GUIDE updated with security reminders

## Pre-Deployment Checklist

- [ ] Generate secure passwords for `.env.production`:
  ```bash
  openssl rand -base64 32  # Run 4 times for each secret
  ```
- [ ] Update domain in `docker-compose.prod.yml` if not using equiyield.sanchez.ph
- [ ] Change default admin password in `apps/server/create-admin.ts`
- [ ] Ensure OCI ingress rules allow ports 80, 443
- [ ] Verify Docker and Docker Compose are installed on server
- [ ] Create `proxy-network` Docker network for NPM integration

## Deployment Steps

1. **Clone to Server:**
   ```bash
   cd /opt && git clone https://github.com/yourusername/EquiYield.git
   cd EquiYield && git checkout v1.0.0
   ```

2. **Configure Environment:**
   ```bash
   cp .env.production.example .env.production
   nano .env.production  # Fill in generated secrets
   ```

3. **Create Network:**
   ```bash
   docker network create proxy-network
   ```

4. **Deploy Stack:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

5. **Seed Demo Data:**
   ```bash
   docker exec equiyield-server npx ts-node /app/apps/server/seed-demo.ts
   ```

6. **Configure NPM:**
   - Add proxy host for equiyield.sanchez.ph → equiyield-web:3000
   - Add proxy for /api → equiyield-server:4000
   - Request Let's Encrypt SSL certificate

7. **Setup Auto-Reset:**
   ```bash
   chmod +x scripts/reset-demo.sh
   crontab -e
   # Add: 0 0 * * * /opt/EquiYield/scripts/reset-demo.sh >> /var/log/equiyield-reset.log 2>&1
   ```

8. **Verify:**
   - Open https://equiyield.sanchez.ph
   - Demo banner should be visible
   - Login with admin@equiyield.local / Admin@123456
   - Change admin password immediately!

## Post-Deployment

- [ ] Change admin password via admin panel
- [ ] Test all features (members, loans, contributions, dividends)
- [ ] Verify auto-reset cron job runs successfully
- [ ] Monitor logs: `docker-compose -f docker-compose.prod.yml logs -f`
- [ ] Setup database backups (see DEPLOYMENT.md Step 8.3)
- [ ] Share demo URL with clients: https://equiyield.sanchez.ph

## Demo Credentials

**Admin:**
- Email: admin@equiyield.local
- Password: Admin@123456 (⚠️ CHANGE IMMEDIATELY)

**Members (all use password: Member@123):**
- juan.delacruz@demo.com
- maria.santos@demo.com
- pedro.reyes@demo.com
- ana.garcia@demo.com
- carlos.lopez@demo.com

## Architecture Overview

```
Internet (HTTPS)
    ↓
Nginx Proxy Manager (SSL Termination)
    ↓
Docker Network: proxy-network
    ↓
┌─────────────────────────────────┐
│  equiyield-web (Next.js:3000)   │
│  - Public frontend              │
│  - Member portal                │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  equiyield-server (Express:4000)│
│  - REST API                     │
│  - Prisma ORM                   │
└─────────────────────────────────┘
    ↓
┌──────────────┬──────────────────┐
│ PostgreSQL   │  Redis Cache     │
│ (Internal)   │  (Internal)      │
└──────────────┴──────────────────┘
```

## Monitoring

**Portainer Dashboard:**
- Container health status
- Resource usage (CPU, RAM, Network)
- Logs viewer
- Console access

**Application Health:**
```bash
curl https://equiyield.sanchez.ph/api/health
```

Expected response:
```json
{
  "ok": true,
  "demoMode": true,
  "version": "1.0.0"
}
```

---

**Need Help?** See full deployment guide in [DEPLOYMENT.md](DEPLOYMENT.md)
