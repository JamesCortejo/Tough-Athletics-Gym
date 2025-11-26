# Development Guide

Complete guide for developers working on the Tough Athletics Gym Management System.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Code Structure](#code-structure)
- [Coding Standards](#coding-standards)
- [Adding New Features](#adding-new-features)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Best Practices](#best-practices)

---

## Getting Started

### Prerequisites

- **Node.js**: v14 or higher
- **MongoDB**: v4.4 or higher
- **Git**: For version control
- **Code Editor**: VS Code recommended
- **Postman/Insomnia**: For API testing (optional)

### Initial Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/JamesCortejo/Tough-Athletics-Gym.git
   cd Tough-Athletics-Gym
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Windows
   mongod
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

---

## Development Environment Setup

### VS Code Extensions (Recommended)

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **MongoDB for VS Code**: Database management
- **Thunder Client**: API testing
- **GitLens**: Git integration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URL=mongodb://localhost:27017

# Secrets
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Tough Athletics Gym" <no-reply@toughgym.com>

# OAuth
GOOGLE_AUTH_CLIENT_ID=your_google_client_id
GOOGLE_AUTH_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
BASE_URL=http://localhost:3000

# reCAPTCHA
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

### Database Setup

1. **Start MongoDB**
2. **Create Database** (automatically created on first use)
3. **Verify Connection** (check server logs)

---

## Code Structure

### Directory Organization

```
src/
├── config/          # Configuration files
├── handlers/        # Business logic
├── routes/          # Route definitions
├── utils/           # Utility functions
└── public/          # Frontend files
    ├── admin_pages/
    ├── user_pages/
    ├── css/
    ├── js/
    └── images/
```

### File Naming Conventions

- **Routes**: `featureRoutes.js` (camelCase)
- **Handlers**: `featureHandler.js` (camelCase)
- **Utils**: `featureUtils.js` (camelCase)
- **HTML**: `featurePage.html` (camelCase)
- **CSS**: `featureStyles.css` (camelCase)
- **JS**: `featureScript.js` (camelCase)

---

## Coding Standards

### JavaScript Style

**Indentation**: 2 spaces
**Quotes**: Single quotes for strings
**Semicolons**: Always use semicolons
**Line Length**: Maximum 100 characters

**Example:**
```javascript
const { connectToDatabase } = require('../config/db');
const { ObjectId } = require('mongodb');

async function getUserData(userId) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId)
    });
    
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}
```

### Naming Conventions

- **Variables**: `camelCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes**: `PascalCase`
- **Files**: `camelCase.js`

### Error Handling

**Always use try-catch blocks:**
```javascript
async function exampleFunction() {
  try {
    // Your code here
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in exampleFunction:', error);
    return { success: false, message: error.message };
  }
}
```

### Async/Await

**Prefer async/await over callbacks:**
```javascript
// Good
async function fetchData() {
  const result = await database.query();
  return result;
}

// Avoid
function fetchData(callback) {
  database.query((result) => {
    callback(result);
  });
}
```

---

## Adding New Features

### Step-by-Step Process

1. **Plan the Feature**
   - Define requirements
   - Identify affected components
   - Design database schema (if needed)

2. **Create Database Schema** (if needed)
   - Define collection structure
   - Create indexes
   - Document in `DATABASE_SCHEMA.md`

3. **Create Handler**
   ```javascript
   // src/handlers/newFeatureHandler.js
   const { connectToDatabase } = require('../config/db');
   
   async function newFeatureFunction(data) {
     try {
       const db = await connectToDatabase();
       // Implementation
       return { success: true, data: result };
     } catch (error) {
       return { success: false, message: error.message };
     }
   }
   
   module.exports = { newFeatureFunction };
   ```

4. **Create Routes**
   ```javascript
   // src/routes/newFeatureRoutes.js
   const express = require('express');
   const router = express.Router();
   const { verifyToken } = require('../handlers/loginHandler');
   const { newFeatureFunction } = require('../handlers/newFeatureHandler');
   
   router.post('/new-feature', verifyToken, async (req, res) => {
     try {
       const result = await newFeatureFunction(req.body);
       res.json(result);
     } catch (error) {
       res.status(500).json({ success: false, message: error.message });
     }
   });
   
   module.exports = router;
   ```

5. **Mount Routes in server.js**
   ```javascript
   const newFeatureRoutes = require('./src/routes/newFeatureRoutes');
   app.use('/api/new-feature', newFeatureRoutes);
   ```

6. **Update Frontend** (if needed)
   - Create HTML page
   - Add CSS styles
   - Implement JavaScript functionality

7. **Update Documentation**
   - Add to API documentation
   - Update README if needed
   - Document database changes

---

## Testing

### Manual Testing Checklist

**Authentication:**
- [ ] User registration
- [ ] User login
- [ ] OAuth login (Google/Facebook)
- [ ] Password reset
- [ ] Admin login
- [ ] Logout

**Membership:**
- [ ] Apply for membership
- [ ] View membership status
- [ ] Admin approval/decline
- [ ] Membership history

**Check-in:**
- [ ] QR code check-in
- [ ] Manual check-in
- [ ] Check-in history
- [ ] Duplicate check-in prevention

**Profile:**
- [ ] View profile
- [ ] Update profile
- [ ] Upload profile picture

**Admin:**
- [ ] View dashboard
- [ ] Manage members
- [ ] Generate reports
- [ ] Account management

### API Testing

**Using Postman/Insomnia:**

1. **Create Collection**: "Tough Athletics Gym API"
2. **Set Environment Variables**:
   - `base_url`: `http://localhost:3000`
   - `token`: (set after login)
3. **Test Endpoints**: Follow API documentation

---

## Debugging

### Console Logging

**Use structured logging:**
```javascript
console.log('🔍 [Feature] Action:', data);
console.error('❌ [Feature] Error:', error);
console.log('✅ [Feature] Success:', result);
```

### Debugging Tips

1. **Check Server Logs**: Monitor console output
2. **Database Queries**: Use MongoDB Compass
3. **Network Requests**: Use browser DevTools
4. **Token Issues**: Verify JWT token in jwt.io
5. **Database Connection**: Check MongoDB status

### Common Issues

**MongoDB Connection Error:**
```bash
# Check if MongoDB is running
mongosh
# Or check process
ps aux | grep mongod
```

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Module Not Found:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

---

## Common Tasks

### Adding a New Route

1. Create route file in `src/routes/`
2. Import handler functions
3. Define routes with middleware
4. Export router
5. Mount in `server.js`

### Adding a New Handler Function

1. Create or update handler file
2. Implement business logic
3. Handle errors
4. Return standardized response
5. Export function

### Adding a New Utility Function

1. Create or update utility file
2. Implement reusable function
3. Add error handling
4. Export function
5. Document usage

### Updating Database Schema

1. Plan schema changes
2. Update handler code
3. Create migration script (if needed)
4. Update documentation
5. Test thoroughly

---

## Best Practices

### Code Quality

1. **Keep Functions Small**: Single responsibility
2. **Use Meaningful Names**: Clear variable/function names
3. **Add Comments**: Explain complex logic
4. **Handle Errors**: Always use try-catch
5. **Validate Input**: Check user input

### Security

1. **Never Log Passwords**: Avoid logging sensitive data
2. **Validate All Input**: Sanitize user input
3. **Use Environment Variables**: Never hardcode secrets
4. **Check Permissions**: Verify user permissions
5. **Use HTTPS**: In production

### Performance

1. **Database Indexes**: Add indexes for frequent queries
2. **Connection Pooling**: Reuse database connections
3. **Limit Results**: Use pagination for large datasets
4. **Optimize Queries**: Use projection to limit fields
5. **Cache When Possible**: Cache frequently accessed data

### Documentation

1. **Update README**: Keep main README current
2. **API Documentation**: Document all endpoints
3. **Code Comments**: Explain complex logic
4. **Commit Messages**: Write clear commit messages
5. **Change Log**: Document major changes

---

## Git Workflow

### Branch Naming

- `feature/feature-name`: New features
- `bugfix/bug-name`: Bug fixes
- `hotfix/issue-name`: Urgent fixes
- `docs/documentation-name`: Documentation updates

### Commit Messages

**Format:**
```
type: brief description

Detailed explanation if needed
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Example:**
```
feat: add membership renewal feature

- Added renewal endpoint
- Updated membership handler
- Added frontend UI
```

---

## Development Tools

### Recommended Tools

1. **MongoDB Compass**: Database GUI
2. **Postman**: API testing
3. **VS Code**: Code editor
4. **Git**: Version control
5. **Nodemon**: Auto-reload server

### VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.formatOnSave": true,
  "files.eol": "\n",
  "javascript.preferences.quoteStyle": "single"
}
```

---

## Troubleshooting

### Common Problems

**Problem**: Server won't start
- **Solution**: Check MongoDB is running
- **Solution**: Verify PORT is not in use
- **Solution**: Check environment variables

**Problem**: Database connection fails
- **Solution**: Verify MongoDB is running
- **Solution**: Check connection string
- **Solution**: Verify network connectivity

**Problem**: OAuth not working
- **Solution**: Check OAuth credentials
- **Solution**: Verify callback URLs
- **Solution**: Check BASE_URL configuration

**Problem**: File upload fails
- **Solution**: Check directory permissions
- **Solution**: Verify multer configuration
- **Solution**: Check file size limits

---

## Getting Help

1. **Check Documentation**: Review all docs
2. **Search Issues**: Check GitHub issues
3. **Ask Questions**: Create GitHub issue
4. **Review Code**: Check similar implementations

---

## Next Steps

1. Set up development environment
2. Review codebase structure
3. Run the application
4. Make your first contribution
5. Follow coding standards
6. Write tests
7. Update documentation

Happy coding! 🚀

