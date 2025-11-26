# Deployment Guide

Complete deployment guide for the Tough Athletics Gym Management System.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Production Environment Setup](#production-environment-setup)
- [Server Configuration](#server-configuration)
- [Database Setup](#database-setup)
- [Security Configuration](#security-configuration)
- [Deployment Methods](#deployment-methods)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Preparation

- [ ] All features tested and working
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Documentation updated

### Security Checklist

- [ ] Strong secrets configured
- [ ] HTTPS enabled
- [ ] CORS configured (if needed)
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] SQL injection prevention (N/A for MongoDB)
- [ ] XSS protection implemented

### Performance Checklist

- [ ] Database indexes created
- [ ] Static assets optimized
- [ ] Image compression applied
- [ ] Caching configured (if applicable)
- [ ] Connection pooling enabled

---

## Production Environment Setup

### Server Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 100 Mbps

**Recommended:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: 1 Gbps

### Operating System

- **Linux**: Ubuntu 20.04 LTS or higher (recommended)
- **Windows Server**: Windows Server 2019 or higher
- **macOS**: macOS Server (for development/testing only)

### Required Software

1. **Node.js**: v14 or higher
2. **MongoDB**: v4.4 or higher
3. **Nginx**: For reverse proxy (recommended)
4. **PM2**: Process manager (recommended)
5. **SSL Certificate**: For HTTPS

---

## Server Configuration

### Node.js Setup

1. **Install Node.js**
   ```bash
   # Using NodeSource repository (Ubuntu)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Verify Installation**
   ```bash
   node --version
   npm --version
   ```

### MongoDB Setup

1. **Install MongoDB**
   ```bash
   # Ubuntu
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   ```

2. **Start MongoDB**
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

3. **Configure MongoDB**
   - Enable authentication
   - Configure firewall rules
   - Set up backups

### PM2 Process Manager

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 Configuration**
   Create `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'tough-gym',
       script: './server.js',
       instances: 2,
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
       merge_logs: true,
       autorestart: true,
       max_memory_restart: '1G'
     }]
   };
   ```

3. **Start Application**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **PM2 Commands**
   ```bash
   pm2 status          # Check status
   pm2 logs            # View logs
   pm2 restart all     # Restart all
   pm2 stop all        # Stop all
   pm2 delete all      # Delete all
   ```

---

## Database Setup

### Production Database Configuration

1. **Enable Authentication**
   ```javascript
   // Create admin user
   use admin
   db.createUser({
     user: "admin",
     pwd: "secure_password",
     roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
   })
   ```

2. **Create Application User**
   ```javascript
   use gymDatabase
   db.createUser({
     user: "gymapp",
     pwd: "secure_password",
     roles: [ { role: "readWrite", db: "gymDatabase" } ]
   })
   ```

3. **Update Connection String**
   ```env
   MONGODB_URL=mongodb://gymapp:secure_password@localhost:27017/gymDatabase?authSource=gymDatabase
   ```

### Database Backups

1. **Manual Backup**
   ```bash
   mongodump --uri="mongodb://gymapp:password@localhost:27017/gymDatabase" --out=/backup/$(date +%Y%m%d)
   ```

2. **Automated Backup Script**
   ```bash
   #!/bin/bash
   BACKUP_DIR="/backup/mongodb"
   DATE=$(date +%Y%m%d_%H%M%S)
   mongodump --uri="mongodb://gymapp:password@localhost:27017/gymDatabase" --out="$BACKUP_DIR/$DATE"
   # Keep only last 7 days
   find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
   ```

3. **Schedule with Cron**
   ```bash
   # Add to crontab
   0 2 * * * /path/to/backup-script.sh
   ```

---

## Security Configuration

### Environment Variables

**Production `.env`:**
```env
NODE_ENV=production
PORT=3000

# Strong, random secrets (minimum 32 characters)
SESSION_SECRET=<generate_strong_secret>
JWT_SECRET=<generate_strong_secret>

# Database
MONGODB_URL=mongodb://gymapp:password@localhost:27017/gymDatabase?authSource=gymDatabase

# Email
EMAIL_USER=your_production_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Tough Athletics Gym" <no-reply@toughgym.com>

# OAuth (Production credentials)
GOOGLE_AUTH_CLIENT_ID=your_production_google_client_id
GOOGLE_AUTH_CLIENT_SECRET=your_production_google_client_secret
FACEBOOK_APP_ID=your_production_facebook_app_id
FACEBOOK_APP_SECRET=your_production_facebook_app_secret
BASE_URL=https://your-domain.com

# reCAPTCHA (Production keys)
RECAPTCHA_SITE_KEY=your_production_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_production_recaptcha_secret_key
```

### Generate Strong Secrets

```bash
# Generate random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### HTTPS Configuration

1. **Obtain SSL Certificate**
   - Use Let's Encrypt (free)
   - Or purchase from CA

2. **Install Certbot**
   ```bash
   sudo apt-get update
   sudo apt-get install certbot python3-certbot-nginx
   ```

3. **Obtain Certificate**
   ```bash
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

### Nginx Configuration

**`/etc/nginx/sites-available/tough-gym`:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy Settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static Files
    location /images {
        alias /path/to/app/src/public/images;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # File Upload Size Limit
    client_max_body_size 10M;
}
```

**Enable Site:**
```bash
sudo ln -s /etc/nginx/sites-available/tough-gym /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## Deployment Methods

### Method 1: Manual Deployment

1. **Clone Repository**
   ```bash
   cd /var/www
   git clone https://github.com/JamesCortejo/Tough-Athletics-Gym.git
   cd Tough-Athletics-Gym
   ```

2. **Install Dependencies**
   ```bash
   npm install --production
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with production values
   ```

4. **Start Application**
   ```bash
   pm2 start ecosystem.config.js
   ```

### Method 2: CI/CD Pipeline

**GitHub Actions Example** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/Tough-Athletics-Gym
            git pull
            npm install --production
            pm2 restart tough-gym
```

---

## Monitoring & Maintenance

### Application Monitoring

1. **PM2 Monitoring**
   ```bash
   pm2 monit
   ```

2. **Log Management**
   ```bash
   # View logs
   pm2 logs tough-gym
   
   # Log rotation
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

### Database Monitoring

1. **MongoDB Monitoring**
   ```bash
   mongosh
   db.serverStatus()
   db.stats()
   ```

2. **Database Health Checks**
   - Monitor connection count
   - Check disk space
   - Review slow queries
   - Monitor replication lag (if applicable)

### System Monitoring

1. **Resource Monitoring**
   ```bash
   # CPU and Memory
   htop
   
   # Disk Usage
   df -h
   
   # Network
   iftop
   ```

2. **Uptime Monitoring**
   - Use services like UptimeRobot
   - Set up alerts for downtime
   - Monitor response times

### Backup Strategy

1. **Daily Backups**
   - Database: Full backup
   - Files: Profile pictures, QR codes
   - Configuration: Environment files

2. **Backup Storage**
   - Local: Keep last 7 days
   - Remote: Weekly backups to cloud storage
   - Test: Regularly test restore process

---

## Troubleshooting

### Application Won't Start

1. **Check Logs**
   ```bash
   pm2 logs tough-gym
   ```

2. **Verify Environment**
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.PORT)"
   ```

3. **Check Port**
   ```bash
   netstat -tulpn | grep 3000
   ```

### Database Connection Issues

1. **Verify MongoDB Status**
   ```bash
   sudo systemctl status mongod
   ```

2. **Test Connection**
   ```bash
   mongosh "mongodb://gymapp:password@localhost:27017/gymDatabase"
   ```

3. **Check Firewall**
   ```bash
   sudo ufw status
   ```

### Performance Issues

1. **Check Resource Usage**
   ```bash
   pm2 monit
   htop
   ```

2. **Database Performance**
   - Check slow queries
   - Review indexes
   - Analyze query patterns

3. **Application Performance**
   - Review PM2 logs
   - Check for memory leaks
   - Optimize database queries

---

## Post-Deployment

### Verification Checklist

- [ ] Application accessible via HTTPS
- [ ] All routes working
- [ ] Database connections stable
- [ ] File uploads working
- [ ] Email service functional
- [ ] OAuth working
- [ ] Reports generating
- [ ] Monitoring active

### Initial Setup

1. **Create Admin Account**
   - Register first admin user
   - Set `isAdmin: true` in database
   - Test admin login

2. **Configure Settings**
   - Update gym information
   - Configure membership plans
   - Set up email templates

3. **Test All Features**
   - User registration
   - Membership application
   - Check-in system
   - Report generation

---

## Maintenance Schedule

### Daily
- Monitor application logs
- Check system resources
- Verify backups completed

### Weekly
- Review error logs
- Check database size
- Update dependencies (if needed)
- Test backup restoration

### Monthly
- Security updates
- Performance review
- Database optimization
- Documentation updates

---

## Support

For deployment issues:
1. Check logs
2. Review documentation
3. Check GitHub issues
4. Contact support

---

## Conclusion

Following this guide will help you deploy the Tough Athletics Gym Management System securely and efficiently. Regular monitoring and maintenance will ensure optimal performance and reliability.

