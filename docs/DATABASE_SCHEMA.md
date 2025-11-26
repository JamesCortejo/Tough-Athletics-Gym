# Database Schema Documentation

Complete database schema documentation for the Tough Athletics Gym Management System.

## Database: `gymDatabase`

The system uses MongoDB with the following collections:

---

## Collections

### 1. `users`

Stores user account information.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  username: String,                 // Unique username
  email: String,                    // Unique email address
  password: String,                 // Hashed password (bcrypt)
  firstName: String,               // User's first name
  lastName: String,                // User's last name
  mobile: String,                  // Phone number
  gender: String,                  // "Male", "Female", "Other"
  age: Number,                     // User's age
  profilePicture: String,          // Path to profile picture
  qrCode: String,                  // Path to QR code image
  qrCodeId: String,                // Unique QR code identifier
  emailVerified: Boolean,          // Email verification status
  needsProfileCompletion: Boolean, // Profile completion flag
  isAdmin: Boolean,                // Admin flag (default: false)
  isArchived: Boolean,             // Archive flag (default: false)
  authMethod: String,              // "local", "google", "facebook"
  googleId: String,                // Google OAuth ID (if applicable)
  facebookId: String,              // Facebook OAuth ID (if applicable)
  createdAt: Date,                 // Account creation timestamp
  updatedAt: Date                  // Last update timestamp
}
```

**Indexes:**
- `username`: Unique index
- `email`: Unique index
- `qrCodeId`: Unique index
- `googleId`: Sparse unique index (if exists)
- `facebookId`: Sparse unique index (if exists)

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "username": "johndoe",
  "email": "john@example.com",
  "password": "$2a$10$hashed_password_here",
  "firstName": "John",
  "lastName": "Doe",
  "mobile": "1234567890",
  "gender": "Male",
  "age": 25,
  "profilePicture": "/images/pfpImages/profile_xxx.jpg",
  "qrCode": "/images/qrImages/QR_ABC123.png",
  "qrCodeId": "QR_ABC123",
  "emailVerified": true,
  "needsProfileCompletion": false,
  "isAdmin": false,
  "isArchived": false,
  "authMethod": "local",
  "createdAt": ISODate("2024-01-01T00:00:00.000Z"),
  "updatedAt": ISODate("2024-01-15T10:30:00.000Z")
}
```

---

### 2. `memberships`

Stores membership applications and active memberships.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  userId: ObjectId,                 // Reference to users._id
  qrCodeId: String,                 // Reference to users.qrCodeId
  planType: String,                 // "Basic", "Premium", "VIP"
  status: String,                   // "Pending", "Active", "Declined", "Expired"
  amount: Number,                   // Membership fee (500, 1200, or 2000)
  startDate: Date,                  // Membership start date
  endDate: Date,                    // Membership end date
  paymentMethod: String,            // Payment method used
  appliedAt: Date,                 // Application submission date
  approvedAt: Date,                 // Approval date (if approved)
  declinedAt: Date,                 // Decline date (if declined)
  declineReason: String,            // Reason for decline (if declined)
  
  // User information snapshot (for reporting)
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  profilePicture: String,
  
  createdAt: Date,                  // Document creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes:**
- `userId`: Index
- `qrCodeId`: Index
- `status`: Index
- `appliedAt`: Index (descending)
- `startDate`: Index
- `endDate`: Index

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "userId": ObjectId("507f1f77bcf86cd799439011"),
  "qrCodeId": "QR_ABC123",
  "planType": "Premium",
  "status": "Active",
  "amount": 1200,
  "startDate": ISODate("2024-01-01T00:00:00.000Z"),
  "endDate": ISODate("2024-02-01T00:00:00.000Z"),
  "paymentMethod": "Cash at Gym",
  "appliedAt": ISODate("2023-12-28T10:00:00.000Z"),
  "approvedAt": ISODate("2023-12-30T14:30:00.000Z"),
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "profilePicture": "/images/pfpImages/profile_xxx.jpg",
  "createdAt": ISODate("2023-12-28T10:00:00.000Z"),
  "updatedAt": ISODate("2023-12-30T14:30:00.000Z")
}
```

---

### 3. `nonmembers`

Stores walk-in customer (non-member) check-in records and payment information.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  firstName: String,                // Customer's first name
  lastName: String,                 // Customer's last name
  gender: String,                   // "Male", "Female", "Other"
  phone: String,                    // Phone number
  email: String,                     // Email address (optional)
  address: String,                   // Customer address
  paymentMethod: String,            // Payment method (default: "Cash at Gym")
  amount: Number,                   // Payment amount (default: 75)
  checkInTime: Date,                // Check-in timestamp
  createdAt: Date,                  // Document creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes:**
- `checkInTime`: Index (descending) - for sorting by most recent
- `phone`: Index - for search functionality
- `email`: Index - for search functionality

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439018"),
  "firstName": "Jane",
  "lastName": "Smith",
  "gender": "Female",
  "phone": "0987654321",
  "email": "jane@example.com",
  "address": "456 Oak Ave",
  "paymentMethod": "Cash at Gym",
  "amount": 75,
  "checkInTime": ISODate("2024-01-15T14:30:00.000Z"),
  "createdAt": ISODate("2024-01-15T14:30:00.000Z"),
  "updatedAt": ISODate("2024-01-15T14:30:00.000Z")
}
```

**Note:** Non-members represent walk-in customers who pay per visit without a membership. These records are used for revenue tracking and reporting.

---

### 4. `usercheckin`

Stores member check-in records.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  userId: ObjectId,                 // Reference to users._id
  membershipId: ObjectId,           // Reference to memberships._id
  qrCodeId: String,                  // QR code identifier
  checkinTime: Date,                 // Check-in timestamp
  
  // Membership snapshot (for reporting)
  planType: String,
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  startDate: Date,
  endDate: Date,
  appliedAt: Date,
  
  // Check-in metadata
  status: String,                   // "checked_in"
  checkedInBy: Object | String,     // Admin info or "system"
  createdAt: Date                   // Document creation timestamp
}
```

**Indexes:**
- `userId`: Index
- `membershipId`: Index
- `qrCodeId`: Index
- `checkinTime`: Index (descending)
- Compound: `{ qrCodeId: 1, checkinTime: 1 }` (for daily check-in queries)

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "userId": ObjectId("507f1f77bcf86cd799439011"),
  "membershipId": ObjectId("507f1f77bcf86cd799439012"),
  "qrCodeId": "QR_ABC123",
  "checkinTime": ISODate("2024-01-15T10:30:00.000Z"),
  "planType": "Premium",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "startDate": ISODate("2024-01-01T00:00:00.000Z"),
  "endDate": ISODate("2024-02-01T00:00:00.000Z"),
  "appliedAt": ISODate("2023-12-28T10:00:00.000Z"),
  "status": "checked_in",
  "checkedInBy": {
    "adminId": ObjectId("507f1f77bcf86cd799439020"),
    "adminName": "admin_user"
  },
  "createdAt": ISODate("2024-01-15T10:30:00.000Z")
}
```

---

### 5. `notifications`

Stores user notifications.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  userId: ObjectId,                 // Reference to users._id
  title: String,                     // Notification title
  message: String,                  // Notification message
  type: String,                     // "info", "success", "warning", "error"
  read: Boolean,                    // Read status (default: false)
  relatedId: String,                // Related entity ID (membership, checkin, etc.)
  createdAt: Date                   // Notification creation timestamp
}
```

**Indexes:**
- `userId`: Index
- `read`: Index
- `createdAt`: Index (descending)
- Compound: `{ userId: 1, read: 1, createdAt: -1 }`

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "userId": ObjectId("507f1f77bcf86cd799439011"),
  "title": "Membership Approved!",
  "message": "Your Premium membership has been approved and is now active.",
  "type": "success",
  "read": false,
  "relatedId": "507f1f77bcf86cd799439012",
  "createdAt": ISODate("2023-12-30T14:30:00.000Z")
}
```

---

### 6. `user_actions`

Stores user action logs for audit purposes.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  userId: String,                   // User ID (as string)
  actionType: String,               // "login", "logout", "register", etc.
  authMethod: String,               // "local", "google", "facebook"
  qrCodeId: String,                 // User's QR code ID
  timestamp: Date,                  // Action timestamp
  ipAddress: String,                // Client IP address
  userAgent: String                 // Client user agent
}
```

**Indexes:**
- `userId`: Index
- `actionType`: Index
- `timestamp`: Index (descending)
- Compound: `{ userId: 1, timestamp: -1 }`

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439015"),
  "userId": "507f1f77bcf86cd799439011",
  "actionType": "login",
  "authMethod": "local",
  "qrCodeId": "QR_ABC123",
  "timestamp": ISODate("2024-01-15T08:00:00.000Z"),
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

---

### 7. `admin_actions`

Stores admin action logs for audit purposes.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  action: String,                   // Action type
  membershipId: ObjectId,           // Related membership (if applicable)
  memberName: String,               // Member name
  membershipPlan: String,           // Membership plan type
  qrCodeId: String,                // Member QR code ID (if applicable)
  checkinTime: Date,               // Check-in time (if applicable)
  adminId: ObjectId,                // Admin user ID
  adminName: String,                // Admin username
  timestamp: Date,                  // Action timestamp
  details: Object                  // Additional action details
}
```

**Indexes:**
- `adminId`: Index
- `action`: Index
- `timestamp`: Index (descending)
- `membershipId`: Index

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439016"),
  "action": "approve_membership",
  "membershipId": ObjectId("507f1f77bcf86cd799439012"),
  "memberName": "John Doe",
  "membershipPlan": "Premium",
  "adminId": ObjectId("507f1f77bcf86cd799439020"),
  "adminName": "admin_user",
  "timestamp": ISODate("2023-12-30T14:30:00.000Z"),
  "details": {
    "startDate": ISODate("2024-01-01T00:00:00.000Z"),
    "endDate": ISODate("2024-02-01T00:00:00.000Z")
  }
}
```

**Action Types:**
- `approve_membership`: Membership approved
- `decline_membership`: Membership declined
- `member_checkin`: Member checked in
- `add_walkin_customer`: Walk-in customer added
- `download_report`: Report downloaded (revenue, membership, checkin, nonmember)
- `create_json_backup`: Database backup created

**Note:** The `admin_actions` collection also includes fields for walk-in customer actions:
- `walkinCheckinId`: ObjectId reference to nonmembers._id
- `walkinCustomerName`: String - Customer's full name
- `walkinCustomerPhone`: String - Customer's phone number
- `walkinCustomerEmail`: String - Customer's email
- `amount`: Number - Payment amount
- `paymentMethod`: String - Payment method used

---

### 8. `password_resets`

Stores password reset codes.

**Schema:**
```javascript
{
  _id: ObjectId,                    // MongoDB unique identifier
  email: String,                     // User email
  code: String,                      // 6-digit reset code
  expiresAt: Date,                  // Code expiration timestamp
  used: Boolean,                     // Whether code has been used
  createdAt: Date                    // Code creation timestamp
}
```

**Indexes:**
- `email`: Index
- `code`: Index
- `expiresAt`: TTL index (auto-delete expired codes)

**Example Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439017"),
  "email": "john@example.com",
  "code": "123456",
  "expiresAt": ISODate("2024-01-15T10:40:00.000Z"),
  "used": false,
  "createdAt": ISODate("2024-01-15T10:30:00.000Z")
}
```

---

## Relationships

### User → Memberships
- One user can have multiple memberships (history)
- Only one active membership per user at a time
- Relationship: `memberships.userId` → `users._id`

### User → Check-ins
- One user can have multiple check-ins
- Relationship: `usercheckin.userId` → `users._id`

### Membership → Check-ins
- One membership can have multiple check-ins
- Relationship: `usercheckin.membershipId` → `memberships._id`

### User → Notifications
- One user can have multiple notifications
- Relationship: `notifications.userId` → `users._id`

### User → Actions
- One user can have multiple action logs
- Relationship: `user_actions.userId` → `users._id` (as string)

---

## Data Validation

### User Validation
- `username`: Required, unique, alphanumeric
- `email`: Required, unique, valid email format
- `password`: Required, minimum 8 characters (hashed with bcrypt)
- `mobile`: Required, valid phone number format
- `gender`: Required, one of: "Male", "Female", "Other"
- `age`: Required, number between 13 and 120

### Membership Validation
- `planType`: Required, one of: "Basic", "Premium", "VIP"
- `status`: Required, one of: "Pending", "Active", "Declined", "Expired"
- `amount`: Required, must match plan type (500, 1200, or 2000)
- `startDate`: Required, valid date
- `endDate`: Required, must be after startDate

### Check-in Validation
- `qrCodeId`: Required, must exist in users collection
- `membershipId`: Required, must exist in memberships collection
- `checkinTime`: Required, valid date
- Only one check-in per user per day allowed

---

## Indexes Summary

### Performance-Critical Indexes

1. **Users Collection**
   - Unique indexes on `username`, `email`, `qrCodeId` for fast lookups
   - Sparse indexes on OAuth IDs for efficient OAuth queries

2. **Memberships Collection**
   - Index on `status` for filtering active/pending memberships
   - Index on `appliedAt` for sorting recent applications
   - Index on `endDate` for expiration queries

3. **Check-ins Collection**
   - Compound index on `{ qrCodeId: 1, checkinTime: 1 }` for daily check-in validation
   - Index on `checkinTime` for time-based queries

4. **Notifications Collection**
   - Compound index on `{ userId: 1, read: 1, createdAt: -1 }` for user notification queries

5. **Action Logs**
   - Index on `timestamp` for chronological queries
   - Compound indexes for user-specific action history

---

## Data Retention

- **User Actions**: Retained indefinitely for audit purposes
- **Admin Actions**: Retained indefinitely for audit purposes
- **Password Resets**: Auto-deleted after expiration (TTL index)
- **Check-ins**: Retained indefinitely for historical records
- **Memberships**: Retained indefinitely for historical records
- **Notifications**: Consider implementing auto-deletion after 90 days (not currently implemented)

---

## Backup Recommendations

1. **Daily Backups**: Full database backup using the built-in JSON backup feature
2. **Backup Location**: Backups are stored in `C:\backup` with dated folders
3. **Backup Format**: Each collection is exported as a separate JSON file
4. **Collections Backed Up**: `users`, `memberships`, `nonmembers`, `admin_actions`, `user_actions`, `usercheckin`, `notifications`
5. **Transaction Logs**: Enable MongoDB oplog for point-in-time recovery
6. **User Data**: Special attention to user data for GDPR compliance
7. **Archived Data**: Consider separate archive database for old records

**Backup Structure:**
```
C:\backup\
  └── 2024-01-15T10-30-00-000Z\
      ├── users.json
      ├── memberships.json
      ├── nonmembers.json
      ├── admin_actions.json
      ├── user_actions.json
      ├── usercheckin.json
      ├── notifications.json
      └── metadata.json
```

---

## Migration Notes

When updating the schema:

1. Always add new fields as optional initially
2. Use migration scripts for data transformation
3. Update indexes after schema changes
4. Test queries after index changes
5. Monitor query performance after migrations

