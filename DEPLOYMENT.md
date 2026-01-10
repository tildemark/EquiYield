# Production Deployment Guide

**Version:** v1.0.0  
**Last Updated:** January 10, 2026  
**Production URL:** https://equiyield.sanchez.ph  
**Platform:** Oracle Cloud Infrastructure (OCI) Always Free Tier + Docker + Portainer + Nginx Proxy Manager

---

## Overview

This guide documents the production deployment of EquiYield v1.0.0, successfully deployed to OCI Ampere ARM64 architecture. The deployment uses Docker containerization with Nginx Proxy Manager for SSL termination and reverse proxying.

**Deployment Results:**
- ✅ Application live at https://equiyield.sanchez.ph
- ✅ SSL certificate installed (Let's Encrypt)
- ✅ Docker containers optimized for ARM64
- ✅ Demo data populated and accessible
- ✅ All features functional and tested

---

## Prerequisites

- OCI Always Free Ampere instance (ARM64) running Ubuntu
- Portainer installed and running
- Nginx Proxy Manager (NPM) installed with external network named "net"
- Domain DNS pointing to your OCI instance IP (A record)
- SSH access to the server
- Git installed on server

**Network Requirements:**
- Port 80 (HTTP) - for Let's Encrypt validation
- Port 443 (HTTPS) - for secure traffic
- Containers must be on NPM's external network for SSL termination

---

## Step 1: Prepare the Server

### 1.1 SSH into Your OCI Instance

```bash
ssh -i your-key.pem ubuntu@your-oci-ip
```

### 1.2 Install Required Tools

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install git if not present
sudo apt install git -y

# Verify Docker is installed
docker --version
docker-compose --version
```

### 1.3 Create Application Directory

```bash
sudo mkdir -p /opt/EquiYield
sudo chown $USER:$USER /opt/EquiYield
cd /opt/EquiYield
```

---

## Step 2: Deploy Application

### 2.1 Clone Repository

```bash
git clone https://github.com/tildemark/EquiYield.git .
```

### 2.2 Create Production Environment File

Create `.env` file in the repository root:

```bash
nano .env
```

**Fill in the following values:**

```env
# Database Configuration
POSTGRES_USER=equiyield
POSTGRES_PASSWORD=<generate with: openssl rand -hex 32>
POSTGRES_DB=equiyield

# Redis Configuration
REDIS_PASSWORD=<generate with: openssl rand -hex 32>

# Application Secrets
JWT_SECRET=<generate with: openssl rand -hex 32>
ADMIN_TOKEN=<generate with: openssl rand -hex 32>

# Application Configuration
DEMO_MODE=true
NEXT_PUBLIC_API_BASE_URL=https://equiyield.sanchez.ph

# Database URLs (constructed from above)
DATABASE_URL=postgresql://equiyield:<POSTGRES_PASSWORD>@postgres:5432/equiyield
REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379
```

**⚠️ IMPORTANT:** 
- Use `openssl rand -hex 32` to generate passwords (NOT `openssl rand -base64 32`)
- Hex passwords avoid special characters that break URL parsing
- Do NOT use passwords with `+`, `/`, or `=` characters
- Replace `<POSTGRES_PASSWORD>` and `<REDIS_PASSWORD>` in DATABASE_URL and REDIS_URL with the actual hex values

### 2.3 Deploy Using Portainer (Recommended)

**Using Git Repository Deployment:**

1. Open Portainer at your NPM URL
2. Go to **Stacks** → **Add Stack**
3. Name: `EquiYield`
4. Build method: **Git Repository**
5. Repository URL: `https://github.com/tildemark/EquiYield`
6. Repository reference: `main`
7. Compose path: `docker-compose.prod.yml`
8. **Environment Variables:** Load from `.env` file or add manually:
   - POSTGRES_USER
   - POSTGRES_PASSWORD (hex-generated)
   - POSTGRES_DB
   - REDIS_PASSWORD (hex-generated)
   - JWT_SECRET
   - ADMIN_TOKEN
   - DEMO_MODE
   - NEXT_PUBLIC_API_BASE_URL
   - DATABASE_URL
   - REDIS_URL
9. Click **Deploy the stack**

**⚠️ Critical:** Ensure the stack is using the `.env` file with hex passwords to avoid Prisma P1013 errors.

### 2.4 Verify Containers are Running

```bash
docker ps
```

You should see:
- `equiyield-postgres` - PostgreSQL 16
- `equiyield-redis` - Redis 7
- `equiyield-server` - Express API (port 4000)
- `equiyield-web` - Next.js frontend (port 3000)

**Verify Networks:**

```bash
docker network inspect net
```

Ensure both `equiyield-server` and `equiyield-web` are connected to the "net" network (NPM's external network).

### 2.5 Seed Demo Data

```bash
docker exec equiyield-server node dist/seed-demo.js
```

**Expected Output:**
```
🌱 Seeding demo data...
⚙️  Setting up system config...
👤 Creating admin user...
👥 Creating sample members...
💰 Creating sample contributions...
🏦 Creating sample loans...
💳 Creating sample loan payments...
💸 Creating sample dividend payouts...

✅ Demo data seeded successfully!

📊 Summary:
   • Admin: admin@equiyield.local / Admin@123456
   • Members: 5 (all use password: Member@123)
   • Contributions: 10
   • Loans: 3 (1 active, 1 pending, 1 paid)
   • Dividend Payouts: 3
```

---

## Step 3: Configure Nginx Proxy Manager

### 3.1 Access NPM Admin Panel

Open your NPM instance (usually at your NPM domain or IP:81)

### 3.2 Add Main Proxy Host

1. Go to **Hosts** → **Proxy Hosts** → **Add Proxy Host**

2. **Details Tab:**
   - Domain Names: `equiyield.sanchez.ph`
   - Scheme: `http`
   - Forward Hostname / IP: `equiyield-web` (Docker container name)
   - Forward Port: `3000`
   - Cache Assets: ✅ ON
   - Block Common Exploits: ✅ ON
   - Websockets Support: ✅ ON

3. **SSL Tab:**
   - SSL Certificate: Request a new SSL certificate
   - Force SSL: ✅ ON
   - HTTP/2 Support: ✅ ON
   - HSTS Enabled: ✅ ON
   - Email: your-email@domain.com
   - Agree to Let's Encrypt ToS: ✅

4. Click **Save**

### 3.3 Add Custom Location for API

**CRITICAL:** The API must be routed separately from the web frontend.

1. Go back to your `equiyield.sanchez.ph` proxy host
2. Click **Edit** → **Custom Locations** tab
3. Click **Add Location**
4. Configure:
   - **Define Location:** `/api`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `equiyield-server`
   - **Forward Port:** `4000`
   - **Websockets Support:** ✅ ON
5. Click **Save**

This configuration routes:
- `equiyield.sanchez.ph/` → Frontend (Next.js on port 3000)
- `equiyield.sanchez.ph/api/*` → Backend API (Express on port 4000)

### 3.4 Verify SSL Certificate

NPM will automatically request and install Let's Encrypt SSL certificate. This may take 1-2 minutes. Check the SSL tab to confirm certificate is active.

**Cloudflare Users:** If using Cloudflare DNS proxy (orange cloud):
1. Temporarily set to **DNS Only** (gray cloud) during SSL generation
2. Wait for Let's Encrypt to issue certificate
3. Re-enable proxy (orange cloud) after certificate is issued

---

## Step 4: Configure OCI Firewall

### 4.1 Add Ingress Rules

1. Go to OCI Console → Networking → Virtual Cloud Networks
2. Select your VCN → Security Lists → Default Security List
3. Add Ingress Rules:

| Type | Source CIDR | Protocol | Port Range | Description |
|------|-------------|----------|------------|-------------|
| Stateful | 0.0.0.0/0 | TCP | 80 | HTTP |
| Stateful | 0.0.0.0/0 | TCP | 443 | HTTPS |

### 4.2 Configure OS Firewall (if UFW is enabled)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## Step 5: Setup Auto-Reset for Demo Data

### 5.1 Make Reset Script Executable

```bash
chmod +x /opt/equiyield/scripts/reset-demo.sh
```

### 5.2 Test Manual Reset

```bash
/opt/equiyield/scripts/reset-demo.sh
```

### 5.3 Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add this line for daily reset at midnight
0 0 * * * /opt/equiyield/scripts/reset-demo.sh >> /var/log/equiyield-reset.log 2>&1
```

### 5.4 Create Log File

```bash
sudo touch /var/log/equiyield-reset.log
sudo chown $USER:$USER /var/log/equiyield-reset.log
```

---

## Step 6: Verify Deployment

### 6.1 Check Application Health

```bash
# Test API directly
curl http://localhost:4000/api/health

# Test through NPM
curl https://equiyield.sanchez.ph/api/health
```

**Expected response:**
```json
{"ok":true}
```

### 6.2 Test Login

**Admin Panel:** https://equiyield.sanchez.ph/admin/login
- Email: `admin@equiyield.local`
- Password: `Admin@123456`

**Member Portal:** https://equiyield.sanchez.ph/member/login
- Email: `juan.delacruz@demo.com`
- Password: `Member@123`

### 6.3 Verify Features

✅ Admin can view members list  
✅ Admin can record contributions  
✅ Admin can approve loans  
✅ Members can view dashboard  
✅ Members can apply for loans  
✅ Transaction ledger displays correctly  
✅ Dividend payouts are visible  

---

## Step 7: Troubleshooting Common Issues

### Issue: P1013 "Invalid port number" Error

**Cause:** Special characters in database password breaking URL parsing

**Solution:**
```bash
# Regenerate passwords using hex (NOT base64)
openssl rand -hex 32

# Update .env file
DATABASE_URL=postgresql://equiyield:HEX_PASSWORD@postgres:5432/equiyield
REDIS_URL=redis://:HEX_PASSWORD@redis:6379

# Delete postgres volume and recreate
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

### Issue: HTTP 525 SSL Handshake Error

**Cause:** Containers not on NPM's external network

**Solution:**
1. Verify docker-compose.prod.yml includes:
   ```yaml
   networks:
     net:
       external: true
   ```
2. Ensure both server and web services list `net` in their networks
3. Restart containers: `docker compose -f docker-compose.prod.yml up -d`

### Issue: "Host not found in upstream equiyield-server"

**Cause:** NPM DNS cache not resolving container names

**Solution:**
1. Delete the proxy host in NPM
2. Recreate it with exact same settings
3. This forces DNS refresh

### Issue: API Returns HTML Instead of JSON

**Cause:** `NEXT_PUBLIC_API_BASE_URL` includes `/api` suffix, causing double `/api/api` paths

**Solution:**
```env
# Wrong
NEXT_PUBLIC_API_BASE_URL=https://equiyield.sanchez.ph/api

# Correct
NEXT_PUBLIC_API_BASE_URL=https://equiyield.sanchez.ph
```

Rebuild web container:
```bash
docker compose -f docker-compose.prod.yml up -d --build web
```

### Issue: TypeScript Compilation Errors

**Cause:** Prisma field names don't match schema

**Solution:**
- Always use exact field names from schema.prisma
- Run `npx prisma generate` after schema changes
- Check imports use correct relative paths
- Refer to working seed-demo.ts for correct field mapping

---

## Step 8: Security Hardening (Production)

### 8.1 Change Default Admin Password

⚠️ **CRITICAL:** Change the admin password immediately after first login.

1. Login as admin
2. Navigate to user profile or settings
3. Update password to a strong, unique value

### 8.2 Secure Environment Variables

```bash
# Set restrictive permissions on .env file
chmod 600 /opt/EquiYield/.env
```

### 8.3 Remove Demo Mode (Optional)

For production use without demo features:

```env
DEMO_MODE=false
```

Then restart containers:
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 8.4 Enable Docker Container Auto-Restart

Already configured in docker-compose.prod.yml with `restart: unless-stopped`

---

## Step 9: Monitoring & Maintenance

### 8.1 View Container Logs

```bash
# All containers
docker-compose -f docker-compose.prod.yml logs -f

# Specific container
docker logs -f equiyield-server
docker logs -f equiyield-web
```

### 8.2 View Application Metrics (Portainer)

1. Open Portainer
2. Go to **Containers**
3. Click on any EquiYield container
4. View stats, logs, console access

### 8.3 Database Backup

```bash
# Create backup script
sudo nano /opt/equiyield/scripts/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/equiyield/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

docker exec equiyield-postgres pg_dump -U postgres equiyield > $BACKUP_DIR/equiyield_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "equiyield_*.sql" -mtime +7 -delete

echo "Backup completed: equiyield_$DATE.sql"
```

```bash
chmod +x /opt/equiyield/scripts/backup-db.sh

# Add to crontab for daily backup at 2 AM
crontab -e
# Add: 0 2 * * * /opt/equiyield/scripts/backup-db.sh >> /var/log/equiyield-backup.log 2>&1
```

### 8.4 Update Application

```bash
cd /opt/equiyield

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Run migrations if needed
docker exec equiyield-server npx prisma migrate deploy
```

---

## Troubleshooting

### Issue: Containers won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check if ports are in use
sudo netstat -tulpn | grep -E '3000|4000|5432|6379'

# Verify environment variables loaded
docker exec equiyield-server env | grep DATABASE
```

### Issue: Database connection error

```bash
# Check if postgres is running and healthy
docker exec equiyield-postgres pg_isready

# Verify credentials match
docker exec equiyield-server env | grep DATABASE_URL

# Check Prisma can connect
docker exec equiyield-server npx prisma db pull
```

### Issue: Can't access from outside

1. Verify OCI ingress rules (ports 80, 443 open to 0.0.0.0/0)
2. Check OS firewall: `sudo ufw status`
3. Verify NPM proxy host configuration and SSL certificate
4. Check DNS propagation: `nslookup equiyield.sanchez.ph`
5. Test direct container access: `curl http://localhost:3000`

### Issue: SSL Certificate Won't Generate

1. Verify domain DNS A record points to correct IP
2. Temporarily disable Cloudflare proxy (set to DNS Only)
3. Ensure ports 80 and 443 are accessible from internet
4. Check NPM logs: `docker logs nginx-proxy-manager`
5. Try manual certificate request in NPM SSL tab

---

## Demo Mode Features

When `DEMO_MODE=true`:

✅ Demo banner visible on all pages  
✅ Pre-populated sample data  
✅ Test accounts ready to use  

**Demo Credentials:**

**Admin Access:**
- Email: `admin@equiyield.local`
- Password: `Admin@123456`
- URL: https://equiyield.sanchez.ph/admin/login

**Member Accounts (all use password: `Member@123`):**
- juan.delacruz@demo.com
- maria.santos@demo.com
- pedro.reyes@demo.com
- ana.garcia@demo.com
- carlos.lopez@demo.com
- URL: https://equiyield.sanchez.ph/member/login

**Sample Data Included:**
- 5 active members with shares
- 10 contribution records
- 3 loans (PENDING, RELEASED, PAID statuses)
- 2 loan payments on PAID loan
- 3 dividend payouts from previous year

---

## Architecture Overview

**Docker Containers:**
```
┌─────────────────────────────────────────────┐
│          Nginx Proxy Manager (NPM)          │
│         SSL Termination & Routing           │
│         (Let's Encrypt Certificate)         │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   Port 3000         Port 4000
        │                 │
┌───────▼───────┐  ┌──────▼───────┐
│  equiyield-   │  │  equiyield-  │
│     web       │  │   server     │
│  (Next.js)    │  │  (Express)   │
└───────┬───────┘  └──────┬───────┘
        │                 │
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │                 │
   Port 5432         Port 6379
        │                 │
┌───────▼───────┐  ┌──────▼───────┐
│  equiyield-   │  │  equiyield-  │
│   postgres    │  │    redis     │
│  (Database)   │  │   (Cache)    │
└───────────────┘  └──────────────┘
```

**Network Configuration:**
- `equiyield-network` (internal): All containers communicate
- `net` (external): NPM's network for SSL/routing access
- Both `web` and `server` must be on both networks

**Deployment Method:**
- Portainer Git Repository sync
- Automatic rebuilds on git push
- Zero-downtime updates with rolling restarts

---

## Cost Analysis (OCI Always Free)

**Resources Used:**
- ✅ 1 Ampere ARM64 instance (4 OCPUs, 24GB RAM) - **FREE**
- ✅ 200GB Block Storage - **FREE**
- ✅ Outbound data transfer (10TB/month) - **FREE**
- ✅ Flexible Network Load Balancer - **FREE**

**Estimated Monthly Cost:** $0 USD (within Always Free tier)

**Performance:**
- ARM64 architecture optimized
- Single-stage Docker builds (fast rebuilds)
- Redis caching for performance
- PostgreSQL with proper indexing
- Next.js standalone mode (minimal footprint)

---

## Production Checklist

Before going live:

- [ ] Changed default admin password
- [ ] Generated secure hex passwords for all services
- [ ] SSL certificate installed and verified
- [ ] DNS properly configured (A record)
- [ ] Firewall rules configured (ports 80, 443)
- [ ] Both containers on NPM's "net" network
- [ ] Custom location `/api` configured in NPM
- [ ] Environment variables loaded correctly
- [ ] Database migrations applied
- [ ] Demo data seeded and tested
- [ ] Admin login works
- [ ] Member login works
- [ ] API health check returns 200
- [ ] Backup script configured
- [ ] Monitoring set up (Portainer)

---

## Support & Documentation

- **Production Site:** https://equiyield.sanchez.ph
- **GitHub Repository:** https://github.com/tildemark/EquiYield
- **Issues:** https://github.com/tildemark/EquiYield/issues
- **Documentation:**
  - [README.md](README.md) - Overview and local setup
  - [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Admin operations
  - [SESSION_LOG.md](SESSION_LOG.md) - Development history
  - [CHANGELOG.md](CHANGELOG.md) - Version history
- **Version:** v1.0.0 (January 10, 2026)
- **License:** MIT

---

## Next Steps

After successful deployment:

1. ✅ Application live at https://equiyield.sanchez.ph
2. ✅ SSL certificate active
3. ✅ Demo data populated
4. ⏩ Change admin password
5. ⏩ Showcase to stakeholders
6. ⏩ Gather user feedback
7. ⏩ Plan v1.1.0 features

---

**🎉 Congratulations! EquiYield v1.0.0 is now live in production!**

**Deployment Date:** January 10, 2026  
**Platform:** OCI Ampere ARM64  
**Status:** ✅ Production Ready  
**URL:** https://equiyield.sanchez.ph
