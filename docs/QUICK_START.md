# Quick Start Guide

Get the Tough Athletics Gym Management System up and running quickly.

## Prerequisites

- Node.js (v14+)
- MongoDB (running locally)
- npm or yarn

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PORT=3000
SESSION_SECRET=your_secret_here
JWT_SECRET=your_jwt_secret_here
MONGODB_URL=mongodb://localhost:27017
```

### 3. Start MongoDB
```bash
# Windows
mongod

# macOS/Linux
sudo systemctl start mongod
```

### 4. Run Application
```bash
npm run dev
```

### 5. Access Application
- User Interface: http://localhost:3000
- Admin Login: http://localhost:3000/admin/login

## First Admin Account

1. Register a regular user account
2. In MongoDB, update the user:
```javascript
db.users.updateOne(
  { username: "your_username" },
  { $set: { isAdmin: true } }
)
```

## Common Commands

```bash
# Development
npm run dev          # Start with auto-reload

# Production
npm start            # Start server

# Database
mongosh              # MongoDB shell
```

## Next Steps

- Read [README.md](../README.md) for overview
- Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for API details
- Review [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) for development

## Troubleshooting

**Port in use?**
```bash
# Find process
lsof -i :3000
# Kill process
kill -9 <PID>
```

**MongoDB not running?**
```bash
# Check status
sudo systemctl status mongod
# Start MongoDB
sudo systemctl start mongod
```

**Module errors?**
```bash
# Reinstall
rm -rf node_modules
npm install
```

## Support

- Documentation: See `docs/` folder
- Issues: GitHub Issues
- Questions: Create GitHub issue

