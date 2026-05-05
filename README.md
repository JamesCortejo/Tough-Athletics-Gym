# Tough Athletics Gym Management System

A comprehensive web-based gym management system built with Node.js, Express, and MongoDB. This system provides complete functionality for managing gym members, memberships, check-ins, and administrative operations.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Tough Athletics Gym Management System is a full-stack application designed to streamline gym operations including:

- **Member Management**: User registration, profiles, and account management
- **Membership Management**: Three-tier membership plans (Basic, Premium, VIP) with approval workflow
- **Check-in System**: QR code-based member check-in with admin verification
- **Admin Dashboard**: Comprehensive admin panel for managing members, memberships, and generating reports
- **Notifications**: In-app notification system for members
- **Reporting**: PDF report generation for revenue, memberships, and check-ins

## Features

### User Features
- User registration with email verification
- Multiple authentication methods (Local, Google OAuth, Facebook OAuth)
- Profile management with photo upload
- Membership application and status tracking
- QR code generation for gym access
- Check-in history viewing
- Password reset functionality
- Real-time notifications

### Admin Features
- Admin authentication and authorization
- Member management (view, archive, activate accounts)
- Membership approval/decline workflow
- QR code scanner for member check-ins
- Comprehensive reporting system (Revenue, Membership, Check-in reports)
- Overview dashboard with statistics
- Non-member management
- Account management for all users

### Security Features
- JWT-based authentication
- Password hashing with bcrypt
- reCAPTCHA integration
- Session management
- Role-based access control (Admin/User)
- User action logging

## Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MongoDB**: Database
- **Passport.js**: Authentication middleware
- **JWT**: Token-based authentication
- **bcryptjs**: Password hashing
- **Nodemailer**: Email service
- **PDFKit**: PDF report generation
- **QRCode**: QR code generation
- **Multer**: File upload handling

### Frontend
- **HTML5/CSS3**: Structure and styling
- **Bootstrap 5**: UI framework
- **JavaScript (Vanilla)**: Client-side logic
- **HTML5-QRCode**: QR code scanning library

### Development Tools
- **Nodemon**: Development server with auto-reload
- **dotenv**: Environment variable management

## Project Structure

```
Tough-Athletics-Gym/
├── server.js                 # Main application entry point
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (not in repo)
│
├── src/
│   ├── config/
│   │   ├── db.js            # MongoDB connection configuration
│   │   └── passport.js      # Passport authentication strategies
│   │
│   ├── handlers/            # Business logic handlers
│   │   ├── adminLoginHandler.js
│   │   ├── checkinHandler.js
│   │   ├── loginHandler.js
│   │   ├── logoutHandler.js
│   │   ├── membershipHandler.js
│   │   ├── notificationHandler.js
│   │   ├── passwordResetHandler.js
│   │   ├── profileHandler.js
│   │   └── registerHandler.js
│   │
│   ├── routes/              # API route definitions
│   │   ├── accountRoutes.js
│   │   ├── activeMembersRoutes.js
│   │   ├── adminroutes.js
│   │   ├── authroutes.js
│   │   ├── checkinRoutes.js
│   │   ├── membershipRoutes.js
│   │   ├── membershipUtilsRoutes.js
│   │   ├── nonMemberRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── overviewRoutes.js
│   │   └── reportsRoutes.js
│   │
│   ├── utils/               # Utility functions
│   │   ├── emailService.js
│   │   ├── membershipDateUtils.js
│   │   ├── multerConfig.js
│   │   ├── pdfGenerator.js
│   │   ├── qrGenerator.js
│   │   ├── recaptcha.js
│   │   └── userActionLogger.js
│   │
│   ├── public/              # Static files and frontend
│   │   ├── admin_pages/     # Admin HTML pages
│   │   ├── user_pages/      # User HTML pages
│   │   ├── css/             # Stylesheets
│   │   ├── js/              # Client-side JavaScript
│   │   ├── images/          # Images and assets
│   │   └── reports/         # Generated PDF reports
│   │
│   └── reports/             # Report storage
│
└── node_modules/            # Dependencies (gitignored)
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running on localhost:27017)
- npm or yarn

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/JamesCortejo/Tough-Athletics-Gym.git
   cd Tough-Athletics-Gym
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   SESSION_SECRET=your_session_secret_here
   JWT_SECRET=your_jwt_secret_here
   MONGODB_URL=mongodb://localhost:27017
   
   # Email Configuration
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM="Tough Athletics Gym" <no-reply@toughgym.com>
   
   # OAuth Configuration
   GOOGLE_AUTH_CLIENT_ID=your_google_client_id
   GOOGLE_AUTH_CLIENT_SECRET=your_google_client_secret
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   BASE_URL=http://localhost:3000
   
   # reCAPTCHA
   RECAPTCHA_SITE_KEY=your_recaptcha_site_key
   RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
   ```

4. **Start MongoDB**
   Ensure MongoDB is running on your system:
   ```bash
   # Windows
   mongod
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

5. **Run the application**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - User interface: `http://localhost:3000`
   - Admin login: `http://localhost:3000/admin/login`

## Configuration

### Database Configuration
The system uses MongoDB with the following database name:
- **Database**: `gymDatabase`
- **Collections**: Automatically created on first use
  - `users`
  - `memberships`
  - `usercheckin`
  - `notifications`
  - `user_actions`
  - `admin_actions`
  - `password_resets`

### Membership Plans
The system supports three membership tiers:
- **Basic**: ₱500/month
- **Premium**: ₱1,200/month
- **VIP**: ₱2,000/month

### Session Configuration
- Session duration: 24 hours
- Secure cookies: Disabled (enable for HTTPS)
- Session storage: Server-side

## Usage

### For Users

1. **Registration**
   - Visit the registration page
   - Fill in personal information
   - Complete reCAPTCHA verification
   - Receive email verification (if configured)

2. **Login**
   - Use username/password
   - Or use Google/Facebook OAuth

3. **Membership Application**
   - Navigate to membership page
   - Select a plan (Basic, Premium, or VIP)
   - Submit application
   - Wait for admin approval

4. **Check-in**
   - Present QR code to admin
   - Admin scans QR code
   - Check-in is recorded automatically

### For Admins

1. **Admin Login**
   - Access `/admin/login`
   - Use admin credentials
   - Access admin dashboard

2. **Member Management**
   - View all members
   - Approve/decline membership applications
   - Archive/activate user accounts
   - View member details

3. **Check-in Management**
   - Use QR code scanner
   - Manually enter QR code ID
   - View check-in history

4. **Reports**
   - Generate revenue reports
   - Generate membership reports
   - Generate check-in reports
   - Export as PDF

## API Documentation

See [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for detailed API endpoint documentation.

## Database Schema

See [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for detailed database schema documentation.

## Authentication

See [AUTHENTICATION.md](./docs/AUTHENTICATION.md) for authentication and authorization details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

ISC License

Copyright (c) 2024 James Cortejo

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

## Author

**James Cortejo**
- GitHub: [@JamesCortejo](https://github.com/JamesCortejo)
- Repository: [Tough-Athletics-Gym](https://github.com/JamesCortejo/Tough-Athletics-Gym)

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/JamesCortejo/Tough-Athletics-Gym/issues) page.

