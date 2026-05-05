# API Documentation

Complete API reference for the Tough Athletics Gym Management System.

## Base URL

All API endpoints are prefixed with the base URL:
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Admin endpoints require admin authentication:
```
Authorization: Bearer <admin_jwt_token>
```

## Response Format

All API responses follow this format:

```json
{
  "success": true|false,
  "message": "Response message",
  "data": {}
}
```

---

## Authentication Routes

### User Registration

**POST** `/register`

Register a new user account.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "mobile": "1234567890",
  "gender": "Male",
  "age": 25,
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!",
  "recaptchaToken": "recaptcha_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful!",
  "redirect": "/?registration=success"
}
```

---

### User Login

**POST** `/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePassword123!",
  "recaptchaToken": "recaptcha_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful!",
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "qrCode": "/images/qrImages/QR_xxx.png",
    "qrCodeId": "QR_xxx"
  },
  "redirect": "/userhomepage"
}
```

---

### OAuth Authentication

**GET** `/auth/google`

Initiate Google OAuth login.

**GET** `/auth/facebook`

Initiate Facebook OAuth login.

**GET** `/auth/google/callback`

Google OAuth callback (handled automatically).

**GET** `/auth/facebook/callback`

Facebook OAuth callback (handled automatically).

---

### Password Reset

**POST** `/forgot-password`

Request password reset code.

**Request Body:**
```json
{
  "email": "john@example.com",
  "recaptchaToken": "recaptcha_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reset code sent to your email",
  "redirect": "/verifyEmail?email=john@example.com"
}
```

---

**POST** `/verify-reset-code`

Verify password reset code.

**Request Body:**
```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code verified successfully",
  "redirect": "/enternewPass?email=john@example.com"
}
```

---

**POST** `/reset-password`

Reset password with verified code.

**Request Body:**
```json
{
  "email": "john@example.com",
  "newPassword": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "redirect": "/?reset=success"
}
```

---

### Logout

**POST** `/api/logout`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful",
  "redirect": "/?logout=success"
}
```

---

## Admin Authentication

### Admin Login

**POST** `/admin/login`

Authenticate admin user.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "token": "admin_jwt_token",
  "admin": {
    "_id": "admin_id",
    "username": "admin",
    "email": "admin@example.com"
  }
}
```

---

### Admin Logout

**POST** `/admin/logout`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Admin logged out successfully"
}
```

---

## Profile Routes

### Get User Profile

**GET** `/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "mobile": "1234567890",
    "gender": "Male",
    "age": 25,
    "profilePicture": "/images/pfpImages/profile_xxx.jpg",
    "qrCode": "/images/qrImages/QR_xxx.png"
  }
}
```

---

### Update User Profile

**POST** `/profile/update`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "mobile": "1234567890",
  "gender": "Male",
  "age": 25
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

### Upload Profile Picture

**POST** `/profile/picture`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```
FormData:
  profilePicture: <file>
```

**Response:**
```json
{
  "success": true,
  "message": "Profile picture updated successfully",
  "profilePicture": "/images/pfpImages/profile_xxx.jpg"
}
```

---

## Membership Routes

### Apply for Membership

**POST** `/api/membership/apply`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "planType": "Premium",
  "paymentMethod": "Cash at Gym"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Membership application submitted successfully!",
  "membershipId": "membership_id",
  "status": "Pending",
  "planType": "Premium",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z"
}
```

---

### Get Current Membership

**GET** `/api/membership/current`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "membership": {
    "_id": "membership_id",
    "planType": "Premium",
    "status": "Active",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-02-01T00:00:00.000Z",
    "amount": 1200
  }
}
```

---

### Get Pending Membership

**GET** `/api/membership/pending`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "membership": {
    "_id": "membership_id",
    "planType": "Premium",
    "status": "Pending",
    "appliedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### Get Membership Status

**GET** `/api/membership/status`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "status": {
    "hasActive": true,
    "hasPending": false,
    "activeMembership": { ... },
    "pendingMembership": null,
    "allMemberships": [ ... ]
  }
}
```

---

### Get Membership History

**GET** `/api/membership/history`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "memberships": [
    {
      "_id": "membership_id",
      "planType": "Premium",
      "status": "Active",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-02-01T00:00:00.000Z"
    }
  ]
}
```

---

## Admin Membership Routes

### Get All Pending Memberships

**GET** `/api/membership/admin/pending`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "memberships": [
    {
      "_id": "membership_id",
      "planType": "Premium",
      "status": "Pending",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "appliedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get All Active Memberships

**GET** `/api/membership/admin/active`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "memberships": [
    {
      "_id": "membership_id",
      "planType": "Premium",
      "status": "Active",
      "firstName": "John",
      "lastName": "Doe",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-02-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Pending Applications with User Details

**GET** `/api/membership/admin/pending-applications`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "applications": [
    {
      "_id": "membership_id",
      "planType": "Premium",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "profilePicture": "/images/pfpImages/profile_xxx.jpg",
      "appliedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Approve Membership

**POST** `/api/membership/admin/approve/:membershipId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Membership approved successfully",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z"
}
```

---

### Decline Membership

**POST** `/api/membership/admin/decline/:membershipId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "reason": "Incomplete payment information"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Membership declined successfully"
}
```

---

### Get Membership Application Details

**GET** `/api/membership/admin/application/:membershipId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "application": {
    "_id": "membership_id",
    "planType": "Premium",
    "status": "Pending",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "appliedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Check-in Routes

### Check-in Member (Admin)

**POST** `/api/membership/checkin/:qrCodeId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Member checked in successfully",
  "membership": {
    "_id": "membership_id",
    "firstName": "John",
    "lastName": "Doe",
    "planType": "Premium",
    "status": "Active"
  }
}
```

---

### Record Check-in

**POST** `/api/membership/record-checkin`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "qrCodeId": "QR_xxx",
  "membershipId": "membership_id",
  "userId": "user_id",
  "firstName": "John",
  "lastName": "Doe",
  "planType": "Premium",
  "email": "john@example.com",
  "phone": "1234567890",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-02-01T00:00:00.000Z",
  "appliedAt": "2024-01-01T00:00:00.000Z",
  "checkinTime": "2024-01-15T10:30:00.000Z",
  "manualEntry": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check-in recorded successfully",
  "checkinId": "checkin_id"
}
```

---

### Get Check-ins for Membership

**GET** `/api/membership/checkins/:membershipId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "checkins": [
    {
      "_id": "checkin_id",
      "membershipId": "membership_id",
      "checkinTime": "2024-01-15T10:30:00.000Z",
      "firstName": "John",
      "lastName": "Doe",
      "planType": "Premium"
    }
  ]
}
```

---

## Notification Routes

### Get User Notifications

**GET** `/api/notifications`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of notifications to return (default: 20)
- `unreadOnly` (optional): Return only unread notifications (default: false)

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "notification_id",
      "title": "Membership Approved!",
      "message": "Your Premium membership has been approved.",
      "type": "success",
      "read": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "unreadCount": 3
}
```

---

### Mark Notification as Read

**POST** `/api/notifications/:notificationId/read`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### Mark All Notifications as Read

**POST** `/api/notifications/read-all`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## Overview Routes (Admin)

### Get Dashboard Overview

**GET** `/api/overview`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "overview": {
    "totalMembers": 150,
    "activeMemberships": 120,
    "pendingMemberships": 5,
    "todayCheckins": 45,
    "totalRevenue": 150000,
    "recentCheckins": [ ... ],
    "recentMemberships": [ ... ]
  }
}
```

---

## Non-Member Routes (Admin)

### Get All Non-Members

**GET** `/api/non-members`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "nonMembers": [
    {
      "_id": "nonmember_id",
      "firstName": "John",
      "lastName": "Doe",
      "gender": "Male",
      "phone": "1234567890",
      "email": "john@example.com",
      "address": "123 Main St",
      "paymentMethod": "Cash at Gym",
      "amount": 75,
      "checkInTime": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Add New Non-Member (Walk-in Customer)

**POST** `/api/non-members`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "gender": "Male",
  "phone": "1234567890",
  "email": "john@example.com",
  "address": "123 Main St",
  "paymentMethod": "Cash at Gym",
  "amount": 75
}
```

**Response:**
```json
{
  "success": true,
  "message": "Walk-in customer added successfully",
  "nonMemberId": "nonmember_id"
}
```

**Note:** This action is logged in the `admin_actions` collection with action type `add_walkin_customer`.

---

### Search Non-Members

**GET** `/api/non-members/search/:searchTerm`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Path Parameters:**
- `searchTerm`: Search term to match against firstName, lastName, email, phone, or address

**Response:**
```json
{
  "success": true,
  "nonMembers": [
    {
      "_id": "nonmember_id",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "1234567890",
      "email": "john@example.com",
      "checkInTime": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Reports Routes (Admin)

All report endpoints require security confirmation (admin password + "CONFIRM" text) and are restricted to full administrators (assistant admins cannot download reports).

### Generate Revenue Report

**POST** `/api/reports/revenue-pdf`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "adminPassword": "admin_password",
  "confirmText": "CONFIRM",
  "period": "all"
}
```

**Query Parameters:**
- `period` (optional): `today`, `week`, `month`, `year`, `all` (default: `all`)

**Response:**
PDF file download

**Note:** The revenue report includes:
- Total revenue from both memberships and non-members (walk-in customers)
- Breakdown of membership revenue and non-member revenue
- Membership details (excluding "Declined" statuses)
- Walk-in customer statistics

---

### Generate Membership Report

**POST** `/api/reports/membership-pdf`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "adminPassword": "admin_password",
  "confirmText": "CONFIRM",
  "period": "all"
}
```

**Query Parameters:**
- `period` (optional): `today`, `week`, `month`, `year`, `all` (default: `all`)

**Response:**
PDF file download

---

### Generate Check-in Report

**POST** `/api/reports/checkin-pdf`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "adminPassword": "admin_password",
  "confirmText": "CONFIRM",
  "period": "all"
}
```

**Query Parameters:**
- `period` (optional): `today`, `week`, `month`, `year`, `all` (default: `all`)

**Response:**
PDF file download

---

### Generate Non-Member Report

**POST** `/api/reports/nonmember-pdf`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "adminPassword": "admin_password",
  "confirmText": "CONFIRM",
  "period": "all"
}
```

**Query Parameters:**
- `period` (optional): `today`, `week`, `month`, `year`, `all` (default: `all`)

**Response:**
PDF file download

**Note:** The non-member report includes:
- Total walk-in customers
- Today's walk-ins
- Total revenue from walk-ins
- Average revenue per customer
- Payment method distribution
- Detailed table of all walk-in customers

---

### Create Database Backup

**POST** `/api/reports/backup/json`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "adminPassword": "admin_password",
  "confirmText": "CONFIRM"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Backup completed successfully.",
  "backupFolderPath": "C:\\backup\\2024-01-15T10-30-00-000Z",
  "folderName": "2024-01-15T10-30-00-000Z",
  "files": [
    {
      "collection": "users",
      "fileName": "users.json",
      "filePath": "C:\\backup\\2024-01-15T10-30-00-000Z\\users.json",
      "sizeBytes": 12345
    },
    {
      "collection": "memberships",
      "fileName": "memberships.json",
      "filePath": "C:\\backup\\2024-01-15T10-30-00-000Z\\memberships.json",
      "sizeBytes": 67890
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**Note:**
- This endpoint creates a backup of all critical collections in separate JSON files
- Each backup is stored in a dated folder under `C:\backup`
- Collections backed up: `users`, `memberships`, `nonmembers`, `admin_actions`, `user_actions`, `usercheckin`, `notifications`
- A `metadata.json` file is also created in each backup folder
- Assistant admins are not authorized to create backups
- This action is logged in the `admin_actions` collection with action type `create_json_backup`

---

## Account Management Routes (Admin)

### Get All Users

**GET** `/api/accounts/users`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `status` (optional): `active`, `archived`, `all` (default: `all`)
- `search` (optional): Search by name, email, or username

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isArchived": false,
      "hasActiveMembership": true
    }
  ]
}
```

---

### Archive User

**POST** `/api/accounts/archive/:userId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "User archived successfully"
}
```

---

### Activate User

**POST** `/api/accounts/activate/:userId`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "User activated successfully"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200`: Success
- `400`: Bad Request (validation errors, missing parameters)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Rate Limiting

Currently, there is no rate limiting implemented. Consider adding rate limiting for production use.

## CORS

CORS is not explicitly configured. Add CORS middleware if accessing the API from different origins.

