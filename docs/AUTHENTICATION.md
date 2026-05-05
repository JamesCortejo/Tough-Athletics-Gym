# Authentication & Authorization Documentation

Complete authentication and authorization system documentation for the Tough Athletics Gym Management System.

## Overview

The system implements a multi-layered authentication and authorization system supporting:
- Local authentication (username/password)
- OAuth authentication (Google, Facebook)
- JWT-based token authentication
- Role-based access control (Admin/User)
- Session management

---

## Authentication Methods

### 1. Local Authentication

Traditional username/password authentication with password hashing.

**Flow:**
1. User submits username and password
2. System validates reCAPTCHA
3. Password is hashed with bcrypt and compared
4. JWT token is generated upon successful authentication
5. Token is returned to client

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Password Hashing:**
- Algorithm: bcrypt
- Salt rounds: 10 (default)
- Stored format: `$2a$10$...`

---

### 2. Google OAuth Authentication

**Flow:**
1. User clicks "Continue with Google"
2. Redirected to Google OAuth consent screen
3. User grants permissions
4. Google redirects back with authorization code
5. System exchanges code for user profile
6. User is created/linked if not exists
7. JWT token is generated
8. User is redirected to appropriate page

**OAuth Scopes:**
- `profile`: User's basic profile information
- `email`: User's email address

**User Profile Mapping:**
```javascript
{
  email: profile.emails[0].value,
  firstName: profile.name.givenName,
  lastName: profile.name.familyName,
  profilePicture: profile.photos[0].value,
  username: email.split("@")[0],
  googleId: profile.id,
  authMethod: "google"
}
```

**Configuration:**
```env
GOOGLE_AUTH_CLIENT_ID=your_google_client_id
GOOGLE_AUTH_CLIENT_SECRET=your_google_client_secret
```

---

### 3. Facebook OAuth Authentication

**Flow:**
1. User clicks "Continue with Facebook"
2. Redirected to Facebook OAuth consent screen
3. User grants permissions
4. Facebook redirects back with authorization code
5. System exchanges code for user profile
6. User is created/linked if not exists
7. JWT token is generated
8. User is redirected to appropriate page

**OAuth Scopes:**
- `email`: User's email address
- `public_profile`: User's public profile information

**Profile Fields:**
- `id`: Facebook user ID
- `emails`: Email addresses
- `name`: Full name
- `displayName`: Display name
- `photos`: Profile photos

**User Profile Mapping:**
```javascript
{
  email: profile.emails[0].value,
  firstName: profile.name.givenName,
  lastName: profile.name.familyName,
  profilePicture: profile.photos[0].value,
  username: email ? email.split("@")[0] : `user_${profile.id}`,
  facebookId: profile.id,
  authMethod: "facebook"
}
```

**Configuration:**
```env
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
BASE_URL=http://localhost:3000
```

---

## JWT Token System

### Token Structure

**User Token Payload:**
```javascript
{
  userId: "user_id_string",
  username: "johndoe",
  email: "john@example.com",
  qrCodeId: "QR_ABC123",
  authMethod: "local" | "google" | "facebook",
  iat: 1234567890,  // Issued at
  exp: 1234654290   // Expiration
}
```

**Admin Token Payload:**
```javascript
{
  userId: "admin_id_string",
  username: "admin",
  email: "admin@example.com",
  isAdmin: true,
  iat: 1234567890,
  exp: 1234654290
}
```

### Token Configuration

- **Algorithm**: HS256 (HMAC SHA-256)
- **Expiration**: 24 hours
- **Secret**: Stored in `JWT_SECRET` environment variable
- **Issuer**: Not specified (can be added)
- **Audience**: Not specified (can be added)

### Token Usage

**Request Header:**
```
Authorization: Bearer <jwt_token>
```

**Token Verification:**
```javascript
// Middleware: verifyToken (for users)
// Middleware: verifyAdminToken (for admins)
```

---

## Session Management

### Express Sessions

**Configuration:**
```javascript
{
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,  // Set to true for HTTPS
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}
```

**Session Storage:**
- Default: In-memory (not recommended for production)
- Recommended: MongoDB session store or Redis

### Passport Sessions

**Serialization:**
```javascript
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});
```

**Deserialization:**
```javascript
passport.deserializeUser(async (id, done) => {
  const user = await usersCollection.findOne({
    _id: new ObjectId(id)
  });
  done(null, user);
});
```

---

## Authorization & Access Control

### Role-Based Access Control (RBAC)

**Roles:**
1. **User**: Regular gym member
   - Can access user pages
   - Can manage own profile
   - Can apply for memberships
   - Cannot access admin pages

2. **Admin**: Gym administrator
   - Can access admin dashboard
   - Can manage all users
   - Can approve/decline memberships
   - Can check in members
   - Can generate reports

### Access Control Implementation

**User Routes:**
- Protected with `verifyToken` middleware
- Checks JWT token validity
- Extracts user information from token
- Attaches user to `req.user`

**Admin Routes:**
- Protected with `verifyAdminToken` middleware
- Checks JWT token validity
- Verifies `isAdmin` flag in database
- Attaches admin to `req.admin`

**Middleware Example:**
```javascript
// User middleware
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// Admin middleware
async function verifyAdminToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid token' });
    
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId),
      isAdmin: true
    });
    
    if (!user) return res.status(403).json({ success: false, message: 'Admin access required' });
    
    req.admin = decoded;
    next();
  });
}
```

---

## Security Features

### 1. Password Security

**Hashing:**
- Algorithm: bcrypt
- Salt rounds: 10
- One-way hashing (cannot be reversed)

**Validation:**
- Minimum length: 8 characters
- Complexity requirements enforced
- Password confirmation required

**Reset:**
- 6-digit code sent via email
- Code expires in 10 minutes
- One-time use codes
- Codes stored with expiration timestamps

### 2. reCAPTCHA Integration

**Purpose:**
- Prevent automated attacks
- Verify human interaction
- Protect registration and login endpoints

**Implementation:**
- Google reCAPTCHA v3 (invisible)
- Score-based verification
- Token validation on server-side

**Protected Endpoints:**
- `/register`
- `/login`
- `/forgot-password`

### 3. Account Security

**Account Status:**
- `isArchived`: Prevents login for archived accounts
- `emailVerified`: Email verification status
- `needsProfileCompletion`: Profile completion requirement

**Account Protection:**
- Admin accounts cannot login via user login page
- Archived accounts cannot login
- OAuth accounts linked to existing email accounts

### 4. Action Logging

**User Actions:**
- Login attempts
- Logout events
- Registration events
- Authentication method tracking

**Admin Actions:**
- Membership approvals/declines
- Member check-ins
- Account management actions

**Log Data:**
- User ID
- Action type
- Timestamp
- IP address
- User agent
- Authentication method

---

## OAuth Account Linking

### Account Linking Strategy

When a user signs in with OAuth:

1. **Check by Provider ID**: Look for existing account with same OAuth ID
2. **Check by Email**: If no provider ID match, check by email
3. **Link Accounts**: If email matches, link OAuth ID to existing account
4. **Create New Account**: If no match, create new account

**Benefits:**
- Users can link multiple authentication methods
- Prevents duplicate accounts
- Seamless authentication experience

---

## Token Refresh

**Current Implementation:**
- Tokens expire after 24 hours
- No refresh token mechanism
- Users must re-authenticate after expiration

**Recommended Enhancement:**
- Implement refresh tokens
- Store refresh tokens securely
- Rotate refresh tokens on use
- Implement token blacklist for logout

---

## Error Handling

### Authentication Errors

**Invalid Credentials:**
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

**Token Errors:**
```json
{
  "success": false,
  "message": "Failed to authenticate token: <error_details>"
}
```

**Access Denied:**
```json
{
  "success": false,
  "message": "Access denied. Admin only."
}
```

**Account Archived:**
```json
{
  "success": false,
  "message": "This account has been archived. Please contact support."
}
```

---

## Best Practices

### For Developers

1. **Never store passwords in plain text**
2. **Always validate tokens on protected routes**
3. **Use HTTPS in production**
4. **Implement rate limiting**
5. **Log authentication events**
6. **Handle OAuth errors gracefully**
7. **Validate all user inputs**
8. **Use environment variables for secrets**

### For Administrators

1. **Use strong admin passwords**
2. **Enable two-factor authentication (if implemented)**
3. **Regularly review admin action logs**
4. **Monitor failed login attempts**
5. **Archive inactive accounts**
6. **Keep OAuth credentials secure**

---

## Configuration Checklist

### Required Environment Variables

```env
# JWT
JWT_SECRET=your_secure_random_string_here

# Session
SESSION_SECRET=your_secure_random_string_here

# OAuth - Google
GOOGLE_AUTH_CLIENT_ID=your_google_client_id
GOOGLE_AUTH_CLIENT_SECRET=your_google_client_secret

# OAuth - Facebook
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
BASE_URL=http://localhost:3000

# reCAPTCHA
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

### Security Recommendations

1. **Use strong, random secrets** (minimum 32 characters)
2. **Enable HTTPS** in production
3. **Set secure cookie flag** when using HTTPS
4. **Implement CORS** if needed
5. **Use rate limiting** to prevent brute force attacks
6. **Regularly update dependencies**
7. **Monitor authentication logs**
8. **Implement account lockout** after failed attempts

---

## Troubleshooting

### Common Issues

**Token Expired:**
- Solution: User must re-authenticate
- Future: Implement refresh tokens

**OAuth Callback Errors:**
- Check OAuth credentials
- Verify callback URLs match
- Check BASE_URL configuration

**Password Reset Not Working:**
- Verify email service configuration
- Check email credentials
- Verify reCAPTCHA is working

**Admin Access Denied:**
- Verify user has `isAdmin: true` in database
- Check token is valid
- Verify admin token middleware is working

---

## Future Enhancements

1. **Two-Factor Authentication (2FA)**
2. **Refresh Token System**
3. **Token Blacklist for Logout**
4. **Account Lockout After Failed Attempts**
5. **Password Strength Meter**
6. **Session Management UI**
7. **OAuth Account Unlinking**
8. **Biometric Authentication Support**

