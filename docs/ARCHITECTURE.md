# System Architecture Documentation

Complete architecture and system design documentation for the Tough Athletics Gym Management System.

## System Overview

The Tough Athletics Gym Management System is a full-stack web application built with a Node.js/Express backend and a traditional HTML/CSS/JavaScript frontend. The system follows a modular architecture with clear separation of concerns.

---

## Architecture Pattern

### MVC-Inspired Pattern

The system follows a modified MVC (Model-View-Controller) pattern:

- **Models**: MongoDB collections (handled by MongoDB driver)
- **Views**: HTML pages in `src/public/`
- **Controllers**: Route handlers in `src/routes/` and business logic in `src/handlers/`

### Layered Architecture

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│    (HTML, CSS, JavaScript)           │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│          Route Layer                │
│    (Express Routes)                 │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│        Handler Layer                │
│    (Business Logic)                  │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│        Data Access Layer             │
│    (MongoDB Collections)             │
└─────────────────────────────────────┘
```

---

## Component Architecture

### 1. Server Layer (`server.js`)

**Responsibilities:**
- Application initialization
- Middleware configuration
- Route mounting
- Server startup

**Key Components:**
- Express app instance
- Session management
- Passport authentication
- Static file serving
- Body parsing middleware

### 2. Configuration Layer (`src/config/`)

**Files:**
- `db.js`: MongoDB connection management
- `passport.js`: Passport authentication strategies

**Responsibilities:**
- Database connection pooling
- OAuth strategy configuration
- User serialization/deserialization

### 3. Route Layer (`src/routes/`)

**Structure:**
- One file per feature domain
- Route definitions only
- Delegates to handlers

**Route Files:**
- `authroutes.js`: Authentication routes
- `adminroutes.js`: Admin-specific routes
- `membershipRoutes.js`: Membership management
- `checkinRoutes.js`: Check-in operations
- `notificationRoutes.js`: Notification system
- `overviewRoutes.js`: Dashboard overview
- `reportsRoutes.js`: Report generation
- `accountRoutes.js`: Account management
- `activeMembersRoutes.js`: Active member queries
- `nonMemberRoutes.js`: Non-member management
- `membershipUtilsRoutes.js`: Membership utilities

### 4. Handler Layer (`src/handlers/`)

**Structure:**
- Business logic implementation
- Database operations
- Data validation
- Error handling

**Handler Files:**
- `loginHandler.js`: User authentication
- `adminLoginHandler.js`: Admin authentication
- `registerHandler.js`: User registration
- `membershipHandler.js`: Membership operations
- `checkinHandler.js`: Check-in operations
- `profileHandler.js`: Profile management
- `passwordResetHandler.js`: Password reset flow
- `notificationHandler.js`: Notification management
- `logoutHandler.js`: Logout operations

### 5. Utility Layer (`src/utils/`)

**Structure:**
- Reusable utility functions
- Service integrations
- Helper functions

**Utility Files:**
- `qrGenerator.js`: QR code generation
- `emailService.js`: Email sending
- `pdfGenerator.js`: PDF report generation
- `userActionLogger.js`: Action logging
- `membershipDateUtils.js`: Date calculations
- `multerConfig.js`: File upload configuration
- `recaptcha.js`: reCAPTCHA verification

### 6. Presentation Layer (`src/public/`)

**Structure:**
- Static HTML pages
- CSS stylesheets
- Client-side JavaScript
- Images and assets

**Directories:**
- `admin_pages/`: Admin interface pages
- `user_pages/`: User interface pages
- `css/`: Stylesheets
- `js/`: Client-side scripts
- `images/`: Image assets

---

## Data Flow

### User Registration Flow

```
User → HTML Form → POST /register
  → authroutes.js
    → registerHandler.js
      → Database (users collection)
      → qrGenerator.js (QR code creation)
      → Response
```

### Membership Application Flow

```
User → POST /api/membership/apply
  → membershipRoutes.js
    → verifyToken (authentication)
    → membershipHandler.js
      → Database (memberships collection)
      → notificationHandler.js (notification)
      → Response
```

### Check-in Flow

```
Admin → POST /api/membership/checkin/:qrCodeId
  → checkinRoutes.js
    → verifyAdminToken (authentication)
    → checkinHandler.js
      → Database (memberships collection - validation)
      → Database (usercheckin collection - record)
      → notificationHandler.js (notification)
      → admin_actions collection (logging)
      → Response
```

---

## Authentication Flow

### Local Authentication

```
1. User submits credentials
2. loginHandler.js validates credentials
3. bcrypt compares password
4. JWT token generated
5. Token returned to client
6. Client stores token
7. Token sent in Authorization header for subsequent requests
```

### OAuth Authentication

```
1. User clicks OAuth button
2. Redirect to OAuth provider
3. User grants permissions
4. Provider redirects with code
5. passport.js exchanges code for profile
6. User created/linked in database
7. JWT token generated
8. Token returned via redirect
```

---

## Database Architecture

### Connection Management

**Pattern:** Singleton connection pool

```javascript
// db.js
let db = null;
let client = null;

async function connectToDatabase() {
  if (db) return db;  // Reuse existing connection
  // ... create new connection
}
```

**Benefits:**
- Single connection instance
- Connection reuse
- Automatic reconnection handling

### Collection Structure

**Collections:**
- `users`: User accounts
- `memberships`: Membership records
- `usercheckin`: Check-in records
- `notifications`: User notifications
- `user_actions`: User action logs
- `admin_actions`: Admin action logs
- `password_resets`: Password reset codes

**Relationships:**
- One-to-many: User → Memberships
- One-to-many: User → Check-ins
- One-to-many: Membership → Check-ins
- One-to-many: User → Notifications

---

## Security Architecture

### Authentication Layers

1. **Transport Layer**: HTTPS (recommended for production)
2. **Application Layer**: JWT tokens
3. **Session Layer**: Express sessions
4. **Database Layer**: MongoDB authentication (if configured)

### Authorization Layers

1. **Route Level**: Middleware checks
2. **Handler Level**: Business logic validation
3. **Database Level**: Query filtering

### Security Middleware Stack

```
Request
  ↓
CORS (if configured)
  ↓
Body Parser
  ↓
Session Middleware
  ↓
Passport Middleware
  ↓
Authentication Middleware (verifyToken/verifyAdminToken)
  ↓
Route Handler
  ↓
Business Logic Handler
  ↓
Database Operation
  ↓
Response
```

---

## File Upload Architecture

### Multer Configuration

**Storage:** Local file system
**Destination:** `src/public/images/pfpImages/`
**Naming:** Timestamp-based unique names

**Flow:**
```
Client → multipart/form-data
  → multer middleware
    → File validation
    → File save to disk
    → Database update (profilePicture path)
    → Response
```

---

## Notification System Architecture

### Notification Flow

```
Event Trigger
  ↓
notificationHandler.js
  ↓
Database (notifications collection)
  ↓
User fetches notifications via API
  ↓
Frontend displays notifications
```

### Notification Types

- `info`: General information
- `success`: Success messages
- `warning`: Warning messages
- `error`: Error messages

---

## Report Generation Architecture

### PDF Generation Flow

```
Admin Request → reportsRoutes.js
  ↓
Database Query (data collection)
  ↓
pdfGenerator.js
  ↓
PDFKit Document Creation
  ↓
Buffer Generation
  ↓
Response (PDF download)
```

### Report Types

1. **Revenue Report**: Financial summary and membership details
2. **Membership Report**: Membership statistics and member lists
3. **Check-in Report**: Check-in statistics and history

---

## Error Handling Architecture

### Error Handling Strategy

**Layers:**
1. **Handler Level**: Try-catch blocks
2. **Route Level**: Error middleware
3. **Application Level**: Global error handler

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error message"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Logging Architecture

### Logging Strategy

**User Actions:**
- Logged to `user_actions` collection
- Includes: userId, actionType, timestamp, IP, userAgent

**Admin Actions:**
- Logged to `admin_actions` collection
- Includes: adminId, action, timestamp, details

**Application Logs:**
- Console logging (development)
- Consider structured logging for production

---

## Scalability Considerations

### Current Limitations

1. **Single Server**: No load balancing
2. **In-Memory Sessions**: Not suitable for multiple servers
3. **File Storage**: Local file system (not cloud storage)
4. **Database**: Single MongoDB instance

### Scalability Recommendations

1. **Session Storage**: Use MongoDB session store or Redis
2. **File Storage**: Migrate to cloud storage (AWS S3, Cloudinary)
3. **Load Balancing**: Add reverse proxy (Nginx)
4. **Database**: Consider MongoDB replica set
5. **Caching**: Implement Redis for frequently accessed data
6. **CDN**: Use CDN for static assets

---

## Performance Optimizations

### Database Optimizations

1. **Indexes**: Strategic indexes on frequently queried fields
2. **Connection Pooling**: Reuse database connections
3. **Query Optimization**: Use projection to limit returned fields

### Frontend Optimizations

1. **Static Assets**: Served directly by Express
2. **Image Optimization**: Consider image compression
3. **Code Splitting**: Consider bundling for production

---

## Deployment Architecture

### Development Environment

```
Developer Machine
  ├── Node.js Application
  ├── MongoDB (localhost)
  └── File System Storage
```

### Production Environment (Recommended)

```
Internet
  ↓
Load Balancer (Nginx)
  ↓
Application Servers (Node.js)
  ├── Session Store (Redis/MongoDB)
  └── File Storage (Cloud Storage)
  ↓
Database Cluster (MongoDB)
```

---

## Technology Stack Summary

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: Passport.js, JWT
- **File Upload**: Multer
- **PDF Generation**: PDFKit
- **Email**: Nodemailer
- **QR Codes**: QRCode library

### Frontend
- **Markup**: HTML5
- **Styling**: CSS3, Bootstrap 5
- **Scripting**: Vanilla JavaScript
- **QR Scanning**: HTML5-QRCode

### Development
- **Package Manager**: npm
- **Process Manager**: nodemon (dev)
- **Environment**: dotenv

---

## Module Dependencies

### Core Dependencies

```
express → Web framework
mongodb → Database driver
passport → Authentication
jsonwebtoken → JWT tokens
bcryptjs → Password hashing
multer → File uploads
pdfkit → PDF generation
qrcode → QR code generation
nodemailer → Email service
```

### Development Dependencies

```
nodemon → Development server
```

---

## Future Architecture Enhancements

1. **API Versioning**: Implement `/api/v1/` structure
2. **Microservices**: Consider service separation
3. **Message Queue**: For async operations
4. **Real-time Updates**: WebSocket integration
5. **Caching Layer**: Redis implementation
6. **Search**: Elasticsearch for advanced search
7. **Monitoring**: Application performance monitoring
8. **Testing**: Unit and integration tests

---

## Code Organization Principles

1. **Separation of Concerns**: Clear layer boundaries
2. **Single Responsibility**: Each module has one purpose
3. **DRY (Don't Repeat Yourself)**: Reusable utilities
4. **Modularity**: Independent, testable modules
5. **Consistency**: Consistent naming and structure

---

## Conclusion

The system follows a well-structured, modular architecture that promotes maintainability and scalability. The clear separation of concerns makes it easy to understand, modify, and extend the system as needed.

