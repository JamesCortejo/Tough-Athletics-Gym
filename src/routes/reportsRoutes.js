// reportsRoutes.js
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const fs = require("fs");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");
const PDFGenerator = require("../utils/pdfGenerator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const pdfGenerator = new PDFGenerator();
const { createJSONBackup } = require("../utils/jsonBackup");

// Middleware for token verification from header or query
function verifyTokenFromSource(req, res, next) {
  let token = req.headers["authorization"];
  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7);
  } else if (req.query.token) {
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

    req.db = db;
    req.adminUser = adminUser;
    next();
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during admin verification",
    });
  }
};

// Middleware for security confirmation (password + CONFIRM text)
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
    const nonmembersCollection = db.collection("nonmembers"); // ADD THIS LINE

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
          // For walk-in customer actions, use the walk-in customer name from nonmembers collection
          if (action.action === "add_walkin_customer") {
            console.log(`🔄 Enriching walk-in customer action: ${action._id}`);

            // METHOD 1: Try to use top-level fields first (new structure)
            if (action.walkinCustomerName) {
              console.log(
                `✅ Using top-level customer data: ${action.walkinCustomerName}`
              );
              enrichedAction.walkinCustomerName = action.walkinCustomerName;
              enrichedAction.memberName = action.walkinCustomerName;
              enrichedAction.memberFirstName =
                action.walkinCustomerName.split(" ")[0];
              enrichedAction.memberLastName = action.walkinCustomerName
                .split(" ")
                .slice(1)
                .join(" ");
              enrichedAction.amount = action.amount;
              enrichedAction.paymentMethod = action.paymentMethod;
            }
            // METHOD 2: Try to use details fields (old structure)
            else if (action.details && action.details.customerName) {
              console.log(
                `✅ Using details customer data: ${action.details.customerName}`
              );
              enrichedAction.walkinCustomerName = action.details.customerName;
              enrichedAction.memberName = action.details.customerName;
              enrichedAction.memberFirstName =
                action.details.customerName.split(" ")[0];
              enrichedAction.memberLastName = action.details.customerName
                .split(" ")
                .slice(1)
                .join(" ");
              enrichedAction.amount = action.details.amount;
              enrichedAction.paymentMethod = action.details.paymentMethod;
            }
            // METHOD 3: Try to lookup from nonmembers collection using walkinCheckinId
            else if (action.walkinCheckinId) {
              console.log(
                `🔍 Looking up nonmember by ID: ${action.walkinCheckinId}`
              );
              const walkinCustomer = await nonmembersCollection.findOne({
                _id: new ObjectId(action.walkinCheckinId),
              });

              if (walkinCustomer) {
                console.log(
                  `✅ Found walk-in customer by ID: ${walkinCustomer.firstName} ${walkinCustomer.lastName}`
                );
                enrichedAction.walkinCustomerName = `${walkinCustomer.firstName} ${walkinCustomer.lastName}`;
                enrichedAction.memberName = `${walkinCustomer.firstName} ${walkinCustomer.lastName}`;
                enrichedAction.memberFirstName = walkinCustomer.firstName;
                enrichedAction.memberLastName = walkinCustomer.lastName;
                enrichedAction.amount = walkinCustomer.amount;
                enrichedAction.paymentMethod = walkinCustomer.paymentMethod;
              }
            }
            // METHOD 4: Try to lookup from nonmembers collection using nonMemberId in details
            else if (action.details && action.details.nonMemberId) {
              console.log(
                `🔍 Looking up nonmember by nonMemberId: ${action.details.nonMemberId}`
              );
              const walkinCustomer = await nonmembersCollection.findOne({
                _id: new ObjectId(action.details.nonMemberId),
              });

              if (walkinCustomer) {
                console.log(
                  `✅ Found walk-in customer by nonMemberId: ${walkinCustomer.firstName} ${walkinCustomer.lastName}`
                );
                enrichedAction.walkinCustomerName = `${walkinCustomer.firstName} ${walkinCustomer.lastName}`;
                enrichedAction.memberName = `${walkinCustomer.firstName} ${walkinCustomer.lastName}`;
                enrichedAction.memberFirstName = walkinCustomer.firstName;
                enrichedAction.memberLastName = walkinCustomer.lastName;
                enrichedAction.amount = walkinCustomer.amount;
                enrichedAction.paymentMethod = walkinCustomer.paymentMethod;
              }
            }
            // METHOD 5: Last resort - try to find by timestamp
            else {
              console.log(
                `🔍 No direct ID found, trying timestamp lookup for action: ${action._id}`
              );
              const actionTime = new Date(action.timestamp);
              const startTime = new Date(actionTime.getTime() - 5 * 60 * 1000); // 5 minutes before
              const endTime = new Date(actionTime.getTime() + 5 * 60 * 1000); // 5 minutes after

              const recentNonmembers = await nonmembersCollection
                .find({
                  checkInTime: {
                    $gte: startTime,
                    $lte: endTime,
                  },
                })
                .sort({ checkInTime: -1 })
                .toArray();

              if (recentNonmembers.length > 0) {
                const nonmember = recentNonmembers[0];
                console.log(
                  `✅ Found matching nonmember by timestamp: ${nonmember.firstName} ${nonmember.lastName}`
                );
                enrichedAction.walkinCustomerName = `${nonmember.firstName} ${nonmember.lastName}`;
                enrichedAction.memberName = `${nonmember.firstName} ${nonmember.lastName}`;
                enrichedAction.memberFirstName = nonmember.firstName;
                enrichedAction.memberLastName = nonmember.lastName;
                enrichedAction.amount = nonmember.amount;
                enrichedAction.paymentMethod = nonmember.paymentMethod;
              } else {
                console.log(
                  `❌ No matching nonmember found for action: ${action._id}`
                );
                // Set default values to avoid "Unknown User"
                enrichedAction.walkinCustomerName = "Walk-in Customer";
                enrichedAction.memberName = "Walk-in Customer";
                enrichedAction.memberFirstName = "Walk-in";
                enrichedAction.memberLastName = "Customer";
              }
            }
          }

          // For membership actions, get member information
          else if (
            action.membershipId &&
            typeof action.membershipId === "object"
          ) {
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
          else if (
            action.targetUserId &&
            typeof action.targetUserId === "object"
          ) {
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
          else if (action.action === "member_checkin" && action.qrCodeId) {
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

// PDF Report Routes
router.post(
  "/revenue-pdf",
  verifyTokenFromSource,
  verifyAdmin,
  verifySecurityConfirmation,
  async (req, res) => {
    try {
      const { period = "all" } = req.query;

      // Check if admin is assistant
      if (req.adminUser.isAssistant) {
        console.log("🔒 Assistant admin attempted to download revenue report");
        return res.status(403).json({
          success: false,
          message: "Assistant admins are not authorized to download reports.",
        });
      }

      const membershipsCollection = req.db.collection("memberships");
      const nonMembersCollection = req.db.collection("nonmembers");

      // Get data for report
      const memberships = await membershipsCollection.find({}).toArray();
      const nonMembers = await nonMembersCollection.find({}).toArray();

      console.log(
        `Generating revenue PDF with ${memberships.length} memberships and ${nonMembers.length} non-members`
      );

      // Generate PDF
      const pdfBuffer = await pdfGenerator.generateRevenueReport(
        memberships,
        nonMembers,
        period
      );

      // Log admin action
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

      // Check if admin is assistant
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

      // Log admin action
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

      // Check if admin is assistant
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

      // Generate PDF
      const pdfBuffer = await pdfGenerator.generateCheckInReport(
        checkins,
        period
      );

      // Log admin action
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

router.post(
  "/nonmember-pdf",
  verifyTokenFromSource,
  verifyAdmin,
  verifySecurityConfirmation,
  async (req, res) => {
    try {
      const { period = "all" } = req.query;

      // Check if admin is assistant
      if (req.adminUser.isAssistant) {
        console.log(
          "🔒 Assistant admin attempted to download non-member report"
        );
        return res.status(403).json({
          success: false,
          message: "Assistant admins are not authorized to download reports.",
        });
      }

      const nonMembersCollection = req.db.collection("nonmembers");

      // Get data for report
      const nonMembers = await nonMembersCollection.find({}).toArray();

      console.log(
        `Generating non-member PDF with ${nonMembers.length} non-members`
      );

      // Generate PDF
      const pdfBuffer = await pdfGenerator.generateNonMemberReport(
        nonMembers,
        period
      );

      // Log admin action
      await req.db.collection("admin_actions").insertOne({
        action: "download_report",
        reportType: "nonmember",
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
        `attachment; filename="nonmember-report-${period}-${
          new Date().toISOString().split("T")[0]
        }.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("Non-member PDF generation error:", error);
      res.status(500).json({
        success: false,
        message: "Error generating non-member report: " + error.message,
      });
    }
  }
);

// Simple JSON backup route
router.post(
  "/backup/json",
  verifyTokenFromSource,
  verifyAdmin,
  verifySecurityConfirmation,
  async (req, res) => {
    try {
      if (req.adminUser.isAssistant) {
        return res.status(403).json({
          success: false,
          message:
            "Assistant admins are not authorized to create database backups.",
        });
      }

      const backupResult = await createJSONBackup();

      await req.db.collection("admin_actions").insertOne({
        action: "create_json_backup",
        folderName: backupResult.folderName,
        folderPath: backupResult.backupFolderPath,
        files: backupResult.files,
        adminId: new ObjectId(req.adminUser._id),
        adminName: req.adminUser.username,
        timestamp: new Date(),
      });

      return res.json(backupResult);
    } catch (error) {
      console.error("JSON backup error:", error);
      res.status(500).json({
        success: false,
        message: "Error creating backup: " + error.message,
      });
    }
  }
);

module.exports = router;
