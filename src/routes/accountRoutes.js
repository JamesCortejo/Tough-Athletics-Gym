// accountRoutes.js
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");
const bcrypt = require("bcryptjs");

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

// TSOP Edit Session Logging (without locking)
const editSessions = new Map(); // Just for tracking, not for locking

// Start edit session (logging only)
router.post("/admin/edit-sessions/start", verifyToken, async (req, res) => {
  try {
    const { sessionId, userId, adminId, adminName, userName } = req.body;
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

    // Get user details for logging
    const targetUser = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { username: 1, email: 1 } }
    );

    // Create session data for tracking (not for locking)
    const sessionData = {
      sessionId,
      userId,
      adminId,
      adminName,
      userName,
      startTime: new Date(),
      timestamp: Date.now(),
    };

    editSessions.set(sessionId, sessionData);

    // Log the edit session start
    const logResult = await db.collection("admin_actions").insertOne({
      action: "start_edit_session",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: adminUser.isAssistant ? "assistant" : "admin",
      timestamp: new Date(),
      details: {
        sessionId: sessionId,
        userName: userName,
        userUsername: targetUser?.username || "Unknown",
        userEmail: targetUser?.email || "Unknown",
        tsopProtocol: "last-write-wins", // Indicate the protocol type
      },
    });

    console.log(`⚡ Performed action: start_edit_session for ${userName}`);
    console.log(
      `Admin: ${adminUser.username} | User: ${userName} (${targetUser?.username}) | Email: ${targetUser?.email} | Action: start_edit_session | ID: ${logResult.insertedId}`
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );

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

// End edit session (logging only)
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

    // Get session data before removing
    const session = editSessions.get(sessionId);

    // Remove session from tracking
    if (editSessions.has(sessionId)) {
      editSessions.delete(sessionId);

      // Get user details for logging
      const targetUser = await usersCollection.findOne(
        { _id: new ObjectId(session.userId) },
        { projection: { username: 1, email: 1 } }
      );

      // Log the edit session end
      const logResult = await db.collection("admin_actions").insertOne({
        action: "end_edit_session",
        targetUserId: new ObjectId(session.userId),
        adminId: new ObjectId(req.user.userId),
        adminName: adminUser.username,
        adminRole: adminUser.isAssistant ? "assistant" : "admin",
        timestamp: new Date(),
        details: {
          sessionId: sessionId,
          userName: session.userName,
          userUsername: targetUser?.username || "Unknown",
          userEmail: targetUser?.email || "Unknown",
          duration: Date.now() - new Date(session.startTime).getTime(),
          tsopProtocol: "last-write-wins",
        },
      });

      console.log(
        `⚡ Performed action: end_edit_session for ${session.userName}`
      );
      console.log(
        `Admin: ${adminUser.username} | User: ${session.userName} (${targetUser?.username}) | Email: ${targetUser?.email} | Action: end_edit_session | ID: ${logResult.insertedId}`
      );
      console.log(
        `${new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      );
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

// Update user account - UPDATED for last-write-wins TSOP with session logging
router.put("/admin/accounts/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      updateData,
      adminPassword,
      confirmText,
      commitTimestamp,
      editSessionId,
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
      console.log("🔒 Assistant admin attempted to edit user account");
      return res.status(403).json({
        success: false,
        message: "Assistant admins are not authorized to edit user accounts.",
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

    // Get current user data to check last update timestamp
    const currentUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
      isAdmin: { $ne: true },
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if this update is based on stale data (optional - for conflict detection)
    let hasConflict = false;
    if (currentUser.lastUpdateTimestamp && commitTimestamp) {
      if (commitTimestamp < currentUser.lastUpdateTimestamp) {
        hasConflict = true;
        console.log(
          `🔄 TSOP Conflict: Update based on stale data for user ${userId}`
        );
      }
    }

    // Remove sensitive fields that shouldn't be updated
    delete updateData.password;
    delete updateData._id;
    delete updateData.googleId;
    delete updateData.facebookId;
    delete updateData.isAdmin;

    // Add updated timestamp and commit timestamp
    updateData.updatedAt = new Date();
    updateData.lastUpdateTimestamp = Date.now(); // Server-side timestamp for last-write-wins
    updateData.lastUpdatedBy = {
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      timestamp: new Date(),
    };

    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(userId),
        isAdmin: { $ne: true },
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
    const logData = {
      action: "update_user_account",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        updatedFields: Object.keys(updateData),
        commitTimestamp: commitTimestamp,
        serverTimestamp: updateData.lastUpdateTimestamp,
        hasConflict: hasConflict,
        tsopProtocol: "last-write-wins",
        editSessionId: editSessionId,
      },
    };

    if (hasConflict) {
      logData.details.conflictResolution =
        "last-write-wins - newer update accepted";
    }

    const logResult = await db.collection("admin_actions").insertOne(logData);

    console.log(
      `⚡ Performed action: update_user_account for ${currentUser.firstName} ${currentUser.lastName}`
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${currentUser.firstName} ${currentUser.lastName} (${currentUser.username}) | Email: ${currentUser.email} | Action: update_user_account | ID: ${logResult.insertedId}`
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );

    res.status(200).json({
      success: true,
      message: "User account updated successfully",
      serverTimestamp: updateData.lastUpdateTimestamp,
      hadConflict: hasConflict,
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

      // Get user for logging
      const targetUser = await usersCollection.findOne({
        _id: new ObjectId(userId),
      });

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
            lastUpdateTimestamp: Date.now(),
            lastUpdatedBy: {
              adminId: new ObjectId(req.user.userId),
              adminName: adminUser.username,
              timestamp: new Date(),
            },
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
      const logResult = await db.collection("admin_actions").insertOne({
        action: "archive_user_account",
        targetUserId: new ObjectId(userId),
        adminId: new ObjectId(req.user.userId),
        adminName: adminUser.username,
        adminRole: "admin",
        timestamp: new Date(),
        details: {
          userName: `${targetUser.firstName} ${targetUser.lastName}`,
          userUsername: targetUser.username,
          userEmail: targetUser.email,
        },
      });

      console.log(
        `⚡ Performed action: archive_user_account for ${targetUser.firstName} ${targetUser.lastName}`
      );
      console.log(
        `Admin: ${adminUser.username} | User: ${targetUser.firstName} ${targetUser.lastName} (${targetUser.username}) | Email: ${targetUser.email} | Action: archive_user_account | ID: ${logResult.insertedId}`
      );
      console.log(
        `${new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      );

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

      // Get user for logging
      const targetUser = await usersCollection.findOne({
        _id: new ObjectId(userId),
      });

      const result = await usersCollection.updateOne(
        {
          _id: new ObjectId(userId),
          isAdmin: { $ne: true }, // Ensure we're not unarchiving admin accounts
        },
        {
          $set: {
            isArchived: false,
            updatedAt: new Date(),
            lastUpdateTimestamp: Date.now(),
            lastUpdatedBy: {
              adminId: new ObjectId(req.user.userId),
              adminName: adminUser.username,
              timestamp: new Date(),
            },
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
      const logResult = await db.collection("admin_actions").insertOne({
        action: "unarchive_user_account",
        targetUserId: new ObjectId(userId),
        adminId: new ObjectId(req.user.userId),
        adminName: adminUser.username,
        adminRole: "admin",
        timestamp: new Date(),
        details: {
          userName: `${targetUser.firstName} ${targetUser.lastName}`,
          userUsername: targetUser.username,
          userEmail: targetUser.email,
        },
      });

      console.log(
        `⚡ Performed action: unarchive_user_account for ${targetUser.firstName} ${targetUser.lastName}`
      );
      console.log(
        `Admin: ${adminUser.username} | User: ${targetUser.firstName} ${targetUser.lastName} (${targetUser.username}) | Email: ${targetUser.email} | Action: unarchive_user_account | ID: ${logResult.insertedId}`
      );
      console.log(
        `${new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      );

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
    const logResult = await db.collection("admin_actions").insertOne({
      action: "promote_to_admin",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        targetUserName: `${userToPromote.firstName} ${userToPromote.lastName}`,
        targetUserUsername: userToPromote.username,
        targetUserEmail: userToPromote.email,
        role: role,
        newRole: role === "assistant" ? "Assistant Admin" : "Full Admin",
      },
    });

    console.log(
      `⚡ Performed action: promote_to_admin for ${userToPromote.firstName} ${userToPromote.lastName}`
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${userToPromote.firstName} ${userToPromote.lastName} (${userToPromote.username}) | Email: ${userToPromote.email} | Action: promote_to_admin | ID: ${logResult.insertedId}`
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );

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
    const logResult = await db.collection("admin_actions").insertOne({
      action: "change_admin_role",
      targetUserId: new ObjectId(adminId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        targetUserName: `${targetAdmin.firstName} ${targetAdmin.lastName}`,
        targetUserUsername: targetAdmin.username,
        targetUserEmail: targetAdmin.email,
        oldRole: targetAdmin.isAssistant ? "Assistant Admin" : "Full Admin",
        newRole: role === "assistant" ? "Assistant Admin" : "Full Admin",
      },
    });

    console.log(
      `⚡ Performed action: change_admin_role for ${targetAdmin.firstName} ${targetAdmin.lastName}`
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${targetAdmin.firstName} ${targetAdmin.lastName} (${targetAdmin.username}) | Email: ${targetAdmin.email} | Action: change_admin_role | ID: ${logResult.insertedId}`
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );

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
    const logResult = await db.collection("admin_actions").insertOne({
      action: "revoke_admin_privileges",
      targetUserId: new ObjectId(adminId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin",
      timestamp: new Date(),
      details: {
        targetUserName: `${targetAdmin.firstName} ${targetAdmin.lastName}`,
        targetUserUsername: targetAdmin.username,
        targetUserEmail: targetAdmin.email,
        oldRole: targetAdmin.isAssistant ? "Assistant Admin" : "Full Admin",
      },
    });

    console.log(
      `⚡ Performed action: revoke_admin_privileges for ${targetAdmin.firstName} ${targetAdmin.lastName}`
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${targetAdmin.firstName} ${targetAdmin.lastName} (${targetAdmin.username}) | Email: ${targetAdmin.email} | Action: revoke_admin_privileges | ID: ${logResult.insertedId}`
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`
    );

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
