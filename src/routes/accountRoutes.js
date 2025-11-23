// accountRoutes.js
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");
const bcrypt = require("bcryptjs");

// TSOP Edit Session Management
const editSessions = new Map(); // In-memory store for active sessions

// Get all user accounts (admin only) - UPDATED to exclude admin accounts
router.get("/admin/accounts", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
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

    // Check if admin is assistant and send role info
    const isAssistant = adminUser.isAssistant || false;

    // Get all users excluding admin accounts and password field
    const users = await usersCollection
      .find(
        { isAdmin: { $ne: true } }, // Exclude admin accounts
        {
          projection: {
            password: 0,
            googleId: 0,
            facebookId: 0,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      users: users,
      // Send admin role info to frontend
      adminRole: isAssistant ? "assistant" : "admin",
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get specific user account details
router.get("/admin/accounts/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = await connectToDatabase();
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

    // Check if admin is assistant
    if (adminUser.isAssistant) {
      console.log("🔒 Assistant admin attempted to access user details");
      // Allow viewing but restrict actions
    }

    const user = await usersCollection.findOne(
      {
        _id: new ObjectId(userId),
        isAdmin: { $ne: true }, // Ensure we're not fetching admin accounts
      },
      {
        projection: {
          password: 0,
          googleId: 0,
          facebookId: 0,
        },
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: user,
      // Send admin role info to frontend
      adminRole: adminUser.isAssistant ? "assistant" : "admin",
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// TSOP Edit Session Management Routes

// Start edit session
router.post("/admin/edit-sessions/start", verifyToken, async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      adminId,
      adminName,
      userName,
      startTime,
      timestamp,
    } = req.body;
    const db = await connectToDatabase();
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

    // Check if admin is assistant
    if (adminUser.isAssistant) {
      return res.status(403).json({
        success: false,
        message: "Assistant admins are not authorized to edit user accounts.",
      });
    }

    // Check if there's already an active session for this user
    const existingSession = Array.from(editSessions.values()).find(
      (session) => session.userId === userId && session.isActive
    );

    if (existingSession) {
      // Another admin is editing this user
      return res.status(409).json({
        success: false,
        conflict: true,
        activeSession: {
          adminName: existingSession.adminName,
          startTime: existingSession.startTime,
          userName: existingSession.userName,
        },
        message: "Another admin is currently editing this user account.",
      });
    }

    // Create new session
    const sessionData = {
      sessionId,
      userId,
      adminId,
      adminName,
      userName,
      startTime: new Date(startTime),
      timestamp,
      isActive: true,
      createdAt: new Date(),
    };

    editSessions.set(sessionId, sessionData);

    // Set timeout to auto-remove session after 30 minutes
    setTimeout(() => {
      if (editSessions.has(sessionId)) {
        editSessions.delete(sessionId);
      }
    }, 30 * 60 * 1000);

    // Log the edit session start
    await db.collection("admin_actions").insertOne({
      action: "start_edit_session",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: adminUser.isAssistant ? "assistant" : "admin",
      timestamp: new Date(),
      details: {
        sessionId: sessionId,
        userName: userName,
      },
    });

    res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: "Edit session started successfully",
    });
  } catch (error) {
    console.error("Start edit session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// End edit session
router.post("/admin/edit-sessions/end", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const db = await connectToDatabase();
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

    // Remove session
    if (editSessions.has(sessionId)) {
      const session = editSessions.get(sessionId);
      editSessions.delete(sessionId);

      // Log the edit session end
      await db.collection("admin_actions").insertOne({
        action: "end_edit_session",
        targetUserId: new ObjectId(session.userId),
        adminId: new ObjectId(req.user.userId),
        adminName: adminUser.username,
        adminRole: adminUser.isAssistant ? "assistant" : "admin",
        timestamp: new Date(),
        details: {
          sessionId: sessionId,
          userName: session.userName,
          duration: Date.now() - new Date(session.startTime).getTime(),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Edit session ended successfully",
    });
  } catch (error) {
    console.error("End edit session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Check edit session status
router.get("/admin/edit-sessions/check", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.query;
    const db = await connectToDatabase();
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

    const isActive =
      editSessions.has(sessionId) && editSessions.get(sessionId).isActive;

    res.status(200).json({
      success: true,
      isActive: isActive,
    });
  } catch (error) {
    console.error("Check edit session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get active edit sessions (for monitoring)
router.get("/admin/edit-sessions/active", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
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

    const activeSessions = Array.from(editSessions.values())
      .filter((session) => session.isActive)
      .map((session) => ({
        sessionId: session.sessionId,
        userId: session.userId,
        adminName: session.adminName,
        userName: session.userName,
        startTime: session.startTime,
        duration: Date.now() - new Date(session.startTime).getTime(),
      }));

    res.status(200).json({
      success: true,
      activeSessions: activeSessions,
    });
  } catch (error) {
    console.error("Get active sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update user account - UPDATED with password confirmation, assistant restriction, and TSOP session validation
router.put("/admin/accounts/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { updateData, adminPassword, confirmText, editSessionId } = req.body; // Added editSessionId
    const db = await connectToDatabase();
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

    // Check if admin is assistant
    if (adminUser.isAssistant) {
      console.log("🔒 Assistant admin attempted to edit user account");
      return res.status(403).json({
        success: false,
        message: "Assistant admins are not authorized to edit user accounts.",
      });
    }

    // TSOP: Verify edit session is still active
    if (editSessionId) {
      const activeSession = editSessions.get(editSessionId);
      if (
        !activeSession ||
        !activeSession.isActive ||
        activeSession.userId !== userId
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Edit session has expired or is no longer active. Please refresh and try again.",
          sessionExpired: true,
        });
      }
    }

    // Verify admin password
    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      adminUser.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin password",
      });
    }

    // Verify confirmation text
    if (confirmText !== "CONFIRM") {
      return res.status(400).json({
        success: false,
        message: "Please type 'CONFIRM' to proceed",
      });
    }

    // Remove sensitive fields that shouldn't be updated
    delete updateData.password;
    delete updateData._id;
    delete updateData.googleId;
    delete updateData.facebookId;
    delete updateData.isAdmin;

    // Add updated timestamp
    updateData.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(userId),
        isAdmin: { $ne: true }, // Ensure we're not updating admin accounts
      },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes made or user not found",
      });
    }

    // End the edit session after successful update
    if (editSessionId && editSessions.has(editSessionId)) {
      editSessions.delete(editSessionId);
    }

    // Log admin action with TSOP info
    await db.collection("admin_actions").insertOne({
      action: "update_user_account",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        updatedFields: Object.keys(updateData),
        editSessionId: editSessionId,
        tsopProtocol: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "User account updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Archive user account - UPDATED with password confirmation and assistant restriction
router.post(
  "/admin/accounts/:userId/archive",
  verifyToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { adminPassword, confirmText } = req.body;
      const db = await connectToDatabase();
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

      // Check if admin is assistant
      if (adminUser.isAssistant) {
        console.log("🔒 Assistant admin attempted to archive user account");
        return res.status(403).json({
          success: false,
          message:
            "Assistant admins are not authorized to archive user accounts.",
        });
      }

      // Verify admin password
      const isPasswordValid = await bcrypt.compare(
        adminPassword,
        adminUser.password
      );
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin password",
        });
      }

      // Verify confirmation text
      if (confirmText !== "CONFIRM") {
        return res.status(400).json({
          success: false,
          message: "Please type 'CONFIRM' to proceed",
        });
      }

      const result = await usersCollection.updateOne(
        {
          _id: new ObjectId(userId),
          isAdmin: { $ne: true }, // Ensure we're not archiving admin accounts
        },
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message:
            "User not found, already archived, or cannot archive admin account",
        });
      }

      // Log admin action
      await db.collection("admin_actions").insertOne({
        action: "archive_user_account",
        targetUserId: new ObjectId(userId),
        adminId: new ObjectId(req.user.userId),
        adminName: adminUser.username,
        adminRole: "admin", // Log the role
        timestamp: new Date(),
      });

      res.status(200).json({
        success: true,
        message: "User account archived successfully",
      });
    } catch (error) {
      console.error("Archive user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Unarchive user account - UPDATED with password confirmation and assistant restriction
router.post(
  "/admin/accounts/:userId/unarchive",
  verifyToken,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { adminPassword, confirmText } = req.body;
      const db = await connectToDatabase();
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

      // Check if admin is assistant
      if (adminUser.isAssistant) {
        console.log("🔒 Assistant admin attempted to unarchive user account");
        return res.status(403).json({
          success: false,
          message:
            "Assistant admins are not authorized to activate user accounts.",
        });
      }

      // Verify admin password
      const isPasswordValid = await bcrypt.compare(
        adminPassword,
        adminUser.password
      );
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid admin password",
        });
      }

      // Verify confirmation text
      if (confirmText !== "CONFIRM") {
        return res.status(400).json({
          success: false,
          message: "Please type 'CONFIRM' to proceed",
        });
      }

      const result = await usersCollection.updateOne(
        {
          _id: new ObjectId(userId),
          isAdmin: { $ne: true }, // Ensure we're not unarchiving admin accounts
        },
        {
          $set: {
            isArchived: false,
            updatedAt: new Date(),
          },
          $unset: {
            archivedAt: 1,
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message:
            "User not found, already active, or cannot modify admin account",
        });
      }

      // Log admin action
      await db.collection("admin_actions").insertOne({
        action: "unarchive_user_account",
        targetUserId: new ObjectId(userId),
        adminId: new ObjectId(req.user.userId),
        adminName: adminUser.username,
        adminRole: "admin", // Log the role
        timestamp: new Date(),
      });

      res.status(200).json({
        success: true,
        message: "User account activated successfully",
      });
    } catch (error) {
      console.error("Unarchive user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Search users - UPDATED to exclude admin accounts and include role info
router.get(
  "/admin/accounts/search/:searchTerm",
  verifyToken,
  async (req, res) => {
    try {
      const { searchTerm } = req.params;
      const db = await connectToDatabase();
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

      const searchRegex = new RegExp(searchTerm, "i");

      const users = await usersCollection
        .find(
          {
            isAdmin: { $ne: true }, // Exclude admin accounts
            $or: [
              { firstName: searchRegex },
              { lastName: searchRegex },
              { email: searchRegex },
              { username: searchRegex },
              { mobile: searchRegex },
            ],
          },
          {
            projection: {
              password: 0,
              googleId: 0,
              facebookId: 0,
            },
          }
        )
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        users: users,
        // Send admin role info to frontend
        adminRole: adminUser.isAssistant ? "assistant" : "admin",
      });
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Admin Management Routes

// Get all admin accounts
router.get("/admin/admins", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
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

    // Check if admin is assistant (they shouldn't access this)
    if (adminUser.isAssistant) {
      return res.status(403).json({
        success: false,
        message: "Assistant admins cannot manage admin accounts.",
      });
    }

    // Get all admin accounts (excluding password)
    const admins = await usersCollection
      .find(
        { isAdmin: true },
        {
          projection: {
            password: 0,
            googleId: 0,
            facebookId: 0,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      admins: admins,
    });
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Promote user to admin
router.post("/admin/promote", verifyToken, async (req, res) => {
  try {
    const { userId, role, adminPassword, confirmText } = req.body;
    const db = await connectToDatabase();
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

    // Check if admin is assistant
    if (adminUser.isAssistant) {
      return res.status(403).json({
        success: false,
        message: "Assistant admins cannot promote users to admin.",
      });
    }

    // Verify admin password
    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      adminUser.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin password",
      });
    }

    // Verify confirmation text
    if (confirmText !== "CONFIRM") {
      return res.status(400).json({
        success: false,
        message: "Please type 'CONFIRM' to proceed",
      });
    }

    // Get user to promote
    const userToPromote = await usersCollection.findOne({
      _id: new ObjectId(userId),
      isAdmin: { $ne: true }, // Ensure we're not promoting an existing admin
    });

    if (!userToPromote) {
      return res.status(404).json({
        success: false,
        message: "User not found or is already an admin",
      });
    }

    // Update user to admin
    const updateData = {
      isAdmin: true,
      isAssistant: role === "assistant",
      promotedAt: new Date(),
      promotedBy: adminUser._id,
      updatedAt: new Date(),
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to promote user",
      });
    }

    // Log admin action
    await db.collection("admin_actions").insertOne({
      action: "promote_to_admin",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        targetUserName: `${userToPromote.firstName} ${userToPromote.lastName}`,
        role: role,
        newRole: role === "assistant" ? "Assistant Admin" : "Full Admin",
      },
    });

    res.status(200).json({
      success: true,
      message: `User promoted to ${
        role === "assistant" ? "Assistant Admin" : "Full Admin"
      } successfully`,
    });
  } catch (error) {
    console.error("Promote user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Change admin role
router.post("/admin/change-role", verifyToken, async (req, res) => {
  try {
    const { adminId, role, adminPassword, confirmText } = req.body;
    const db = await connectToDatabase();
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

    // Check if admin is assistant
    if (adminUser.isAssistant) {
      return res.status(403).json({
        success: false,
        message: "Assistant admins cannot change admin roles.",
      });
    }

    // Cannot change own role
    if (adminId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own admin role.",
      });
    }

    // Verify admin password
    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      adminUser.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin password",
      });
    }

    // Verify confirmation text
    if (confirmText !== "CONFIRM") {
      return res.status(400).json({
        success: false,
        message: "Please type 'CONFIRM' to proceed",
      });
    }

    // Get target admin
    const targetAdmin = await usersCollection.findOne({
      _id: new ObjectId(adminId),
      isAdmin: true,
    });

    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Update admin role
    const updateData = {
      isAssistant: role === "assistant",
      updatedAt: new Date(),
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(adminId) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to update admin role",
      });
    }

    // Log admin action
    await db.collection("admin_actions").insertOne({
      action: "change_admin_role",
      targetUserId: new ObjectId(adminId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        targetUserName: `${targetAdmin.firstName} ${targetAdmin.lastName}`,
        oldRole: targetAdmin.isAssistant ? "Assistant Admin" : "Full Admin",
        newRole: role === "assistant" ? "Assistant Admin" : "Full Admin",
      },
    });

    res.status(200).json({
      success: true,
      message: `Admin role updated to ${
        role === "assistant" ? "Assistant Admin" : "Full Admin"
      } successfully`,
    });
  } catch (error) {
    console.error("Change admin role error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Revoke admin privileges
router.post("/admin/revoke", verifyToken, async (req, res) => {
  try {
    const { adminId, adminPassword, confirmText } = req.body;
    const db = await connectToDatabase();
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

    // Check if admin is assistant
    if (adminUser.isAssistant) {
      return res.status(403).json({
        success: false,
        message: "Assistant admins cannot revoke admin privileges.",
      });
    }

    // Cannot revoke own admin privileges
    if (adminId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot revoke your own admin privileges.",
      });
    }

    // Verify admin password
    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      adminUser.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin password",
      });
    }

    // Verify confirmation text
    if (confirmText !== "CONFIRM") {
      return res.status(400).json({
        success: false,
        message: "Please type 'CONFIRM' to proceed",
      });
    }

    // Get target admin
    const targetAdmin = await usersCollection.findOne({
      _id: new ObjectId(adminId),
      isAdmin: true,
    });

    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Revoke admin privileges
    const updateData = {
      isAdmin: false,
      isAssistant: false,
      adminRevokedAt: new Date(),
      adminRevokedBy: adminUser._id,
      updatedAt: new Date(),
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(adminId) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to revoke admin privileges",
      });
    }

    // Log admin action
    await db.collection("admin_actions").insertOne({
      action: "revoke_admin_privileges",
      targetUserId: new ObjectId(adminId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        targetUserName: `${targetAdmin.firstName} ${targetAdmin.lastName}`,
        oldRole: targetAdmin.isAssistant ? "Assistant Admin" : "Full Admin",
      },
    });

    res.status(200).json({
      success: true,
      message: "Admin privileges revoked successfully",
    });
  } catch (error) {
    console.error("Revoke admin error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
