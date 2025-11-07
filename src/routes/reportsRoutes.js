// reportsRoutes.js
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");
const PDFGenerator = require("../utils/pdfGenerator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); // NEW: Import bcrypt for password verification

const pdfGenerator = new PDFGenerator();

// Middleware for token verification from header or query
function verifyTokenFromSource(req, res, next) {
  // Try to get token from Authorization header first
  let token = req.headers["authorization"];
  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7);
  }
  // If no token in header, try query parameter (fallback)
  else if (req.query.token) {
    token = req.query.token;
    console.warn(
      "Token used in URL parameter - consider using Authorization header for better security"
    );
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// Middleware for admin verification and database connection
const verifyAdmin = async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    const adminUser = await usersCollection.findOne({
      _id: new ObjectId(req.user.userId),
      isAdmin: true,
    });

    if (!adminUser) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    req.db = db; // Attach db to request for use in routes
    req.adminUser = adminUser; // NEW: Attach admin user for role checking
    next();
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during admin verification",
    });
  }
};

// NEW: Middleware for security confirmation (password + CONFIRM text)
const verifySecurityConfirmation = async (req, res, next) => {
  try {
    const { adminPassword, confirmText } = req.body;

    if (!adminPassword) {
      return res.status(400).json({
        success: false,
        message: "Admin password is required",
      });
    }

    if (confirmText !== "CONFIRM") {
      return res.status(400).json({
        success: false,
        message: 'Please type "CONFIRM" to proceed',
      });
    }

    // Verify admin password
    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      req.adminUser.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin password",
      });
    }

    next();
  } catch (error) {
    console.error("Security confirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Security confirmation failed",
    });
  }
};

// Get admin actions with filtering
router.get("/admin/actions", verifyToken, async (req, res) => {
  try {
    const { adminId, actionType, sortOrder = "newest" } = req.query;
    const db = await connectToDatabase();
    const adminActionsCollection = db.collection("admin_actions");
    const usersCollection = db.collection("users");
    const membershipsCollection = db.collection("memberships");

    // Verify admin user
    const adminUser = await usersCollection.findOne({
      _id: new ObjectId(req.user.userId),
      isAdmin: true,
    });

    if (!adminUser) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    let query = {};

    // Filter by admin - Handle both string and ObjectId formats
    if (adminId && adminId !== "all") {
      const stringAdminId = adminId;
      let objectIdAdminId;
      try {
        objectIdAdminId = new ObjectId(adminId);
      } catch (error) {
        objectIdAdminId = null;
      }

      query.$or = [
        { adminId: stringAdminId },
        { adminId: objectIdAdminId },
      ].filter((condition) => condition.adminId !== null);

      if (query.$or.length === 0) {
        delete query.$or;
      }
    }

    // Filter by action type
    if (actionType && actionType !== "all") {
      query.action = actionType;
    }

    // Sort order
    const sortDirection = sortOrder === "oldest" ? 1 : -1;

    const actions = await adminActionsCollection
      .find(query)
      .sort({ timestamp: sortDirection })
      .toArray();

    console.log(`Found ${actions.length} admin actions`);

    // Enrich actions with user information
    const enrichedActions = await Promise.all(
      actions.map(async (action) => {
        let enrichedAction = { ...action };

        try {
          // For membership actions, get member information
          if (action.membershipId && typeof action.membershipId === "object") {
            const membership = await membershipsCollection.findOne({
              _id: action.membershipId,
            });

            if (membership) {
              enrichedAction.memberFirstName = membership.firstName;
              enrichedAction.memberLastName = membership.lastName;
              enrichedAction.memberEmail = membership.email;
              enrichedAction.memberQrCodeId = membership.qrCodeId;

              // If memberName is missing but we have first/last name, create it
              if (
                !enrichedAction.memberName &&
                membership.firstName &&
                membership.lastName
              ) {
                enrichedAction.memberName = `${membership.firstName} ${membership.lastName}`;
              }
            }
          }

          // For user account actions, get target user information
          if (action.targetUserId && typeof action.targetUserId === "object") {
            const targetUser = await usersCollection.findOne({
              _id: action.targetUserId,
            });

            if (targetUser) {
              enrichedAction.targetFirstName = targetUser.firstName;
              enrichedAction.targetLastName = targetUser.lastName;
              enrichedAction.targetEmail = targetUser.email;
              enrichedAction.targetUsername = targetUser.username;

              // Create targetUserName if missing
              if (
                !enrichedAction.targetUserName &&
                targetUser.firstName &&
                targetUser.lastName
              ) {
                enrichedAction.targetUserName = `${targetUser.firstName} ${targetUser.lastName}`;
              }
            }
          }

          // For check-in actions, get member information from membership
          if (action.action === "member_checkin" && action.qrCodeId) {
            const membership = await membershipsCollection.findOne({
              qrCodeId: action.qrCodeId,
              status: "Active",
            });

            if (membership && !enrichedAction.memberName) {
              enrichedAction.memberName = `${membership.firstName} ${membership.lastName}`;
              enrichedAction.memberFirstName = membership.firstName;
              enrichedAction.memberLastName = membership.lastName;
            }
          }
        } catch (error) {
          console.error(`Error enriching action ${action._id}:`, error);
        }

        return enrichedAction;
      })
    );

    // Get all admin users
    const allAdmins = await usersCollection
      .find(
        { isAdmin: true },
        {
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            username: 1,
            email: 1,
          },
        }
      )
      .toArray();

    res.status(200).json({
      success: true,
      actions: enrichedActions,
      admins: allAdmins,
    });
  } catch (error) {
    console.error("Get admin actions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get user actions with filtering
router.get("/admin/user-actions", verifyToken, async (req, res) => {
  try {
    const { userId, actionType, sortOrder = "newest" } = req.query;
    const db = await connectToDatabase();
    const userActionsCollection = db.collection("user_actions");
    const usersCollection = db.collection("users");

    // Verify admin user
    const adminUser = await usersCollection.findOne({
      _id: new ObjectId(req.user.userId),
      isAdmin: true,
    });

    if (!adminUser) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    let query = {};

    // Filter by user
    if (userId && userId !== "all") {
      query.userId = userId;
    }

    // Filter by action type
    if (actionType && actionType !== "all") {
      query.actionType = actionType;
    }

    // Sort order
    const sortDirection = sortOrder === "oldest" ? 1 : -1;

    const actions = await userActionsCollection
      .find(query)
      .sort({ timestamp: sortDirection })
      .toArray();

    // Get unique users for filter dropdown
    const userIds = [...new Set(actions.map((action) => action.userId))];
    const users = await usersCollection
      .find(
        {
          _id: { $in: userIds.map((id) => new ObjectId(id)) },
        },
        {
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            username: 1,
            email: 1,
          },
        }
      )
      .toArray();

    res.status(200).json({
      success: true,
      actions: actions,
      users: users,
    });
  } catch (error) {
    console.error("Get user actions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// PDF Report Routes - UPDATED with security confirmation and assistant restriction
router.post(
  "/revenue-pdf",
  verifyTokenFromSource,
  verifyAdmin,
  verifySecurityConfirmation,
  async (req, res) => {
    try {
      const { period = "all" } = req.query;

      // NEW: Check if admin is assistant
      if (req.adminUser.isAssistant) {
        console.log("🔒 Assistant admin attempted to download revenue report");
        return res.status(403).json({
          success: false,
          message: "Assistant admins are not authorized to download reports.",
        });
      }

      const membershipsCollection = req.db.collection("memberships");

      // Get data for report
      const memberships = await membershipsCollection.find({}).toArray();

      console.log(
        `Generating revenue PDF with ${memberships.length} memberships`
      );

      // Generate PDF (removed unused checkins parameter)
      const pdfBuffer = await pdfGenerator.generateRevenueReport(
        memberships,
        period
      );

      // NEW: Log admin action
      await req.db.collection("admin_actions").insertOne({
        action: "download_report",
        reportType: "revenue",
        period: period,
        adminId: new ObjectId(req.adminUser._id),
        adminName: req.adminUser.username,
        adminRole: req.adminUser.isAssistant ? "assistant" : "admin",
        timestamp: new Date(),
      });

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="revenue-report-${period}-${
          new Date().toISOString().split("T")[0]
        }.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("Revenue PDF generation error:", error);
      res.status(500).json({
        success: false,
        message: "Error generating revenue report: " + error.message,
      });
    }
  }
);

router.post(
  "/membership-pdf",
  verifyTokenFromSource,
  verifyAdmin,
  verifySecurityConfirmation,
  async (req, res) => {
    try {
      const { period = "all" } = req.query;

      // NEW: Check if admin is assistant
      if (req.adminUser.isAssistant) {
        console.log(
          "🔒 Assistant admin attempted to download membership report"
        );
        return res.status(403).json({
          success: false,
          message: "Assistant admins are not authorized to download reports.",
        });
      }

      const membershipsCollection = req.db.collection("memberships");
      const usersCollection = req.db.collection("users");

      // Get data for report
      const memberships = await membershipsCollection.find({}).toArray();
      const users = await usersCollection
        .find({ isAdmin: { $ne: true } })
        .toArray();

      console.log(
        `Generating membership PDF with ${memberships.length} memberships and ${users.length} users`
      );

      // Generate PDF
      const pdfBuffer = await pdfGenerator.generateMembershipReport(
        memberships,
        users,
        period
      );

      // NEW: Log admin action
      await req.db.collection("admin_actions").insertOne({
        action: "download_report",
        reportType: "membership",
        period: period,
        adminId: new ObjectId(req.adminUser._id),
        adminName: req.adminUser.username,
        adminRole: req.adminUser.isAssistant ? "assistant" : "admin",
        timestamp: new Date(),
      });

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="membership-report-${period}-${
          new Date().toISOString().split("T")[0]
        }.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("Membership PDF generation error:", error);
      res.status(500).json({
        success: false,
        message: "Error generating membership report: " + error.message,
      });
    }
  }
);

router.post(
  "/checkin-pdf",
  verifyTokenFromSource,
  verifyAdmin,
  verifySecurityConfirmation,
  async (req, res) => {
    try {
      const { period = "all" } = req.query;

      // NEW: Check if admin is assistant
      if (req.adminUser.isAssistant) {
        console.log("🔒 Assistant admin attempted to download checkin report");
        return res.status(403).json({
          success: false,
          message: "Assistant admins are not authorized to download reports.",
        });
      }

      const usercheckinCollection = req.db.collection("usercheckin");

      // Get data for report
      const checkins = await usercheckinCollection.find({}).toArray();

      console.log(`Generating checkin PDF with ${checkins.length} checkins`);

      // Generate PDF (removed unused memberships parameter)
      const pdfBuffer = await pdfGenerator.generateCheckInReport(
        checkins,
        period
      );

      // NEW: Log admin action
      await req.db.collection("admin_actions").insertOne({
        action: "download_report",
        reportType: "checkin",
        period: period,
        adminId: new ObjectId(req.adminUser._id),
        adminName: req.adminUser.username,
        adminRole: req.adminUser.isAssistant ? "assistant" : "admin",
        timestamp: new Date(),
      });

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="checkin-report-${period}-${
          new Date().toISOString().split("T")[0]
        }.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("Check-in PDF generation error:", error);
      res.status(500).json({
        success: false,
        message: "Error generating check-in report: " + error.message,
      });
    }
  }
);

module.exports = router;
