# Production Deployment Guide - OCI Always Free + Portainer + NPM

**Target Environment:** Oracle Cloud Infrastructure (OCI) Always Free Ampere instance  
**Domain:** equiyield.sanchez.ph  
**Tech Stack:** Docker + Portainer + Nginx Proxy Manager

---

## Prerequisites

- OCI Always Free Ampere instance (ARM64)
- Portainer installed and running
- Nginx Proxy Manager installed and running
- Domain DNS pointing to your OCI instance IP
- SSH access to the server

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
sudo mkdir -p /opt/equiyield
sudo chown $USER:$USER /opt/equiyield
cd /opt/equiyield
```

---

## Step 2: Deploy Application

### 2.1 Clone Repository

```bash
git clone https://github.com/yourusername/EquiYield.git .
git checkout v1.0.0
```

### 2.2 Create Production Environment File

```bash
cp .env.production.example .env.production
nano .env.production
```

**Fill in the following values:**

```env
POSTGRES_PASSWORD=<generate with: openssl rand -base64 32>
REDIS_PASSWORD=<generate with: openssl rand -base64 32>
JWT_SECRET=<generate with: openssl rand -base64 32>
ADMIN_TOKEN=<generate with: openssl rand -base64 32>
DEMO_MODE=true
NEXT_PUBLIC_API_BASE_URL=https://equiyield.sanchez.ph/api
DOMAIN=equiyield.sanchez.ph
```

### 2.3 Create Docker Network for NPM

```bash
docker network create proxy-network
```

### 2.4 Build and Deploy with Portainer

**Option A: Using Portainer UI**

1. Open Portainer at `https://your-oci-ip:9443`
2. Go to **Stacks** → **Add Stack**
3. Name: `equiyield`
4. Upload `docker-compose.prod.yml`
5. Add environment variables from `.env.production`
6. Deploy stack

**Option B: Using Docker Compose CLI**

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 2.5 Verify Containers are Running

```bash
docker ps
```

You should see:
- `equiyield-postgres`
- `equiyield-redis`
- `equiyield-server`
- `equiyield-web`

### 2.6 Seed Demo Data

```bash
docker exec equiyield-server npx ts-node /app/apps/server/seed-demo.ts
```

---

## Step 3: Configure Nginx Proxy Manager

### 3.1 Access NPM Admin Panel

Open your NPM instance (usually at `https://your-oci-ip:81`)

### 3.2 Add Proxy Host

1. Go to **Hosts** → **Proxy Hosts** → **Add Proxy Host**

2. **Details Tab:**
   - Domain Names: `equiyield.sanchez.ph`
   - Scheme: `http`
   - Forward Hostname / IP: `equiyield-web` (container name)
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

4. **Advanced Tab (Optional):**

```nginx
# Custom Nginx configuration
location /api {
    proxy_pass http://equiyield-server:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

5. Click **Save**

### 3.3 Verify SSL Certificate

NPM will automatically request and install Let's Encrypt SSL certificate. This may take 1-2 minutes.

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
# Check server health
curl https://equiyield.sanchez.ph/api/health

# Expected response:
# {"ok":true,"demoMode":true,"version":"1.0.0"}
```

### 6.2 Access the Application

- **Admin Panel:** https://equiyield.sanchez.ph/admin/login
  - Email: `admin@equiyield.local`
  - Password: `Admin@123456` (⚠️ Change immediately!)

- **Member Portal:** https://equiyield.sanchez.ph/member/login
  - Email: `juan.delacruz@demo.com`
  - Password: `Member@123`

### 6.3 Verify Demo Banner

You should see the demo mode banner at the top of every page.

---

## Step 7: Security Hardening (Production)

### 7.1 Change Default Passwords

```bash
# Access the admin panel and change password immediately
```

### 7.2 Update Admin Creation Script

```bash
nano /opt/equiyield/apps/server/create-admin.ts
# Change the default password to something secure
```

### 7.3 Restrict Database Access

```bash
# Edit docker-compose.prod.yml to remove port exposure for postgres and redis
# They should only be accessible within the Docker network
```

### 7.4 Enable Docker Container Auto-Restart

Containers are already configured with `restart: unless-stopped` in docker-compose.prod.yml

### 7.5 Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/equiyield
```

Add:

```
/var/log/equiyield-reset.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## Step 8: Monitoring & Maintenance

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
docker-compose -f docker-compose.prod.yml logs

# Check if ports are in use
sudo netstat -tulpn | grep -E '3000|4000|5432|6379'
```

### Issue: SSL certificate failed

1. Verify domain DNS is pointing to correct IP
2. Check NPM logs: `docker logs nginx-proxy-manager`
3. Ensure ports 80 and 443 are open in OCI and OS firewall

### Issue: Database connection error

```bash
# Check if postgres is running
docker exec equiyield-postgres pg_isready

# Verify DATABASE_URL in .env.production
# Ensure password matches POSTGRES_PASSWORD
```

### Issue: Can't access from outside

1. Verify OCI ingress rules (ports 80, 443)
2. Check OS firewall: `sudo ufw status`
3. Verify NPM proxy host configuration
4. Check DNS propagation: `nslookup equiyield.sanchez.ph`

---

## Demo Mode Features

When `DEMO_MODE=true`:

✅ Demo banner visible on all pages  
✅ Higher rate limits (200 req/15min vs 100)  
✅ Auto-reset data daily at midnight  
✅ Health endpoint shows demo status  
✅ Sample accounts pre-populated

**Demo Credentials:**

- **Admin:** admin@equiyield.local / Admin@123456
- **Members:** All use password `Member@123`
  - juan.delacruz@demo.com
  - maria.santos@demo.com
  - pedro.reyes@demo.com
  - ana.garcia@demo.com
  - carlos.lopez@demo.com

---

## Cost Analysis (OCI Always Free)

**Resources Used:**
- ✅ 1 Ampere ARM64 instance (4 OCPUs, 24GB RAM) - **FREE**
- ✅ 200GB Block Storage - **FREE**
- ✅ Outbound data transfer (10TB/month) - **FREE**

**Estimated Monthly Cost:** $0 USD (within Always Free tier)

---

## Support & Documentation

- **GitHub Repository:** https://github.com/yourusername/EquiYield
- **Issues:** https://github.com/yourusername/EquiYield/issues
- **Version:** v1.0.0
- **License:** MIT

---

## Next Steps

1. ✅ Deploy to OCI
2. ✅ Configure NPM and SSL
3. ⏳ Change default admin password
4. ⏳ Showcase to clients at https://equiyield.sanchez.ph
5. ⏳ Gather feedback and iterate

---

**Congratulations! Your EquiYield demo is now live! 🎉**
