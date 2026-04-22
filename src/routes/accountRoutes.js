// accountRoutes.js
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");
const bcrypt = require("bcryptjs");
const encryptionService = require("../utils/encryptionService");
const activeEditSessions = new Map();
const userEditLocks = new Map();

setInterval(
  () => {
    const now = Date.now();

    // Clean up active sessions
    for (const [sessionId, session] of activeEditSessions.entries()) {
      if (now - session.timestamp > 10 * 60 * 1000) {
        activeEditSessions.delete(sessionId);
        console.log(`Cleaned up stale session: ${sessionId}`);
      }
    }

    // Clean up stale locks (older than 2 minutes)
    for (const [userId, lock] of userEditLocks.entries()) {
      if (now - lock.timestamp > 2 * 60 * 1000) {
        userEditLocks.delete(userId);
        console.log(`Cleaned up stale lock for user: ${userId}`);
      }
    }
  },
  5 * 60 * 1000,
);

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
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    // Decrypt sensitive data for all users
    const decryptedUsers = users.map((user) =>
      encryptionService.decryptObject(user, ["email", "mobile"]),
    );

    res.status(200).json({
      success: true,
      users: decryptedUsers,
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
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Decrypt sensitive data
    const decryptedUser = encryptionService.decryptObject(user, [
      "email",
      "mobile",
    ]);

    res.status(200).json({
      success: true,
      user: decryptedUser,
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

// Start edit session - LAST-OPENER-WINS
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
      { projection: { username: 1, email: 1 } },
    );

    // Decrypt email for logging
    const decryptedTargetUser = encryptionService.decryptObject(targetUser, [
      "email",
    ]);

    // Check if there's an existing lock for this user
    const existingLock = userEditLocks.get(userId);
    const now = Date.now();

    // Create session data
    const sessionData = {
      sessionId,
      userId,
      adminId,
      adminName,
      userName,
      startTime: new Date(),
      timestamp: now,
      isActive: true,
    };

    // Remove any existing sessions for this admin and user combination
    for (const [sid, sess] of activeEditSessions.entries()) {
      if (sess.userId === userId && sess.adminId === adminId) {
        activeEditSessions.delete(sid);
        console.log(`Removed previous session for same admin: ${sid}`);
      }
    }

    // Add new session
    activeEditSessions.set(sessionId, sessionData);

    // Apply LAST-OPENER-WINS: Update the lock to current admin
    userEditLocks.set(userId, {
      lockedBy: adminId,
      sessionId: sessionId,
      timestamp: now,
      lockedByName: adminName,
    });

    // Log the edit session start with lock transfer info
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
        userUsername: decryptedTargetUser?.username || "Unknown",
        userEmail: decryptedTargetUser?.email || "Unknown",
        lockStatus: "acquired",
        lockType: "last-opener-wins",
        previousLockHolder: existingLock ? existingLock.lockedByName : null,
      },
    });

    if (existingLock && existingLock.lockedBy !== adminId) {
      console.log(
        `🔄 LOCK TRANSFERRED: User ${userName} lock transferred from ${existingLock.lockedByName} to ${adminName}`,
      );
    } else {
      console.log(
        `🔒 LOCK ACQUIRED: Admin ${adminName} opened edit modal for ${userName}`,
      );
    }

    console.log(
      `Session ID: ${sessionId} | Timestamp: ${new Date().toISOString()}`,
    );

    res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: "Edit session started",
      lockAcquired: true,
      previousLockHolder: existingLock ? existingLock.lockedByName : null,
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

    // Get session data before removing
    const session = activeEditSessions.get(sessionId);

    // Remove session from active sessions
    if (activeEditSessions.has(sessionId)) {
      activeEditSessions.delete(sessionId);

      if (session) {
        // Check if this session currently holds the lock
        const currentLock = userEditLocks.get(session.userId);
        if (currentLock && currentLock.sessionId === sessionId) {
          // This session holds the lock - release it
          userEditLocks.delete(session.userId);
          console.log(
            `🔓 LOCK RELEASED: Admin ${session.adminName} released lock for user ${session.userName}`,
          );
        }

        // Get user details for logging
        const targetUser = await usersCollection.findOne(
          { _id: new ObjectId(session.userId) },
          { projection: { username: 1, email: 1 } },
        );

        // Decrypt email for logging
        const decryptedTargetUser = encryptionService.decryptObject(
          targetUser,
          ["email"],
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
            userUsername: decryptedTargetUser?.username || "Unknown",
            userEmail: decryptedTargetUser?.email || "Unknown",
            lockStatus: "released",
            duration: Date.now() - session.timestamp,
          },
        });

        console.log(`Session ended: ${sessionId} for user ${session.userName}`);
      }
    }

    res.status(200).json({
      success: true,
      message: "Edit session ended",
      lockReleased: true,
    });
  } catch (error) {
    console.error("End edit session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Check lock status for a user
router.get(
  "/admin/edit-sessions/status/:userId",
  verifyToken,
  async (req, res) => {
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

      const lock = userEditLocks.get(userId);
      const now = Date.now();

      // Check if lock is stale (older than 2 minutes)
      let isStale = false;
      if (lock && now - lock.timestamp > 2 * 60 * 1000) {
        isStale = true;
        userEditLocks.delete(userId); // Clean up stale lock
      }

      res.status(200).json({
        success: true,
        isLocked: lock && !isStale,
        lockedBy: lock && !isStale ? lock.lockedByName : null,
        lockedById: lock && !isStale ? lock.lockedBy : null,
        lockTimestamp: lock ? lock.timestamp : null,
        sessionId: lock ? lock.sessionId : null,
        isStale: isStale,
        currentAdminId: req.user.userId,
      });
    } catch (error) {
      console.error("Check lock status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// Validate if admin can save (holds the lock)
router.post("/admin/edit-sessions/validate", verifyToken, async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
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

    const lock = userEditLocks.get(userId);
    const now = Date.now();

    let canSave = false;
    let message = "";

    if (!lock) {
      // No lock exists
      canSave = true;
      message = "No active lock on this account";
    } else if (now - lock.timestamp > 2 * 60 * 1000) {
      // Lock is stale
      userEditLocks.delete(userId);
      canSave = true;
      message = "Previous lock was stale and has been cleared";
    } else if (lock.sessionId === sessionId) {
      // This session holds the lock
      canSave = true;
      message = "You hold the current edit lock";
    } else {
      // Lock held by someone else
      canSave = false;
      message = `This account is currently being edited by ${lock.lockedByName}. You cannot save changes.`;
    }

    res.status(200).json({
      success: true,
      canSave: canSave,
      message: message,
      lockedBy: lock ? lock.lockedByName : null,
      lockTimestamp: lock ? lock.timestamp : null,
    });
  } catch (error) {
    console.error("Validate save error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update user account - Check lock before updating
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
      adminUser.password,
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

    // Validate if admin can save (holds the lock)
    const lock = userEditLocks.get(userId);
    const now = Date.now();

    if (lock && !(now - lock.timestamp > 2 * 60 * 1000)) {
      // Check if lock is held by this session
      if (lock.sessionId !== editSessionId) {
        return res.status(409).json({
          success: false,
          message: `You cannot save changes because this account is currently being edited by ${lock.lockedByName}.`,
          lockedBy: lock.lockedByName,
          requiresReload: true,
        });
      }
    }

    // Get current user data
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

    // Check if this update is based on stale data
    let hasConflict = false;
    if (currentUser.lastUpdateTimestamp && commitTimestamp) {
      if (commitTimestamp < currentUser.lastUpdateTimestamp) {
        hasConflict = true;
        console.log(
          `🔄 TSOP Conflict: Update based on stale data for user ${userId}`,
        );
      }
    }

    // Remove sensitive fields
    delete updateData.password;
    delete updateData._id;
    delete updateData.googleId;
    delete updateData.facebookId;
    delete updateData.isAdmin;

    // Encrypt email and mobile before updating
    if (updateData.email) {
      updateData.email = encryptionService.encrypt(updateData.email);
    }
    if (updateData.mobile) {
      updateData.mobile = encryptionService.encrypt(updateData.mobile);
    }

    // Add updated timestamp
    updateData.updatedAt = new Date();
    updateData.lastUpdateTimestamp = Date.now();
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
      { $set: updateData },
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes made or user not found",
      });
    }

    // Release the lock after successful update
    if (userEditLocks.has(userId) && editSessionId) {
      const currentLock = userEditLocks.get(userId);
      if (currentLock.sessionId === editSessionId) {
        userEditLocks.delete(userId);
      }
    }

    // Remove the session
    if (editSessionId && activeEditSessions.has(editSessionId)) {
      activeEditSessions.delete(editSessionId);
    }

    // Get updated user for logging
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    // Decrypt for logging
    const decryptedUser = encryptionService.decryptObject(updatedUser, [
      "email",
      "mobile",
    ]);

    // Log admin action
    const logResult = await db.collection("admin_actions").insertOne({
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
        sessionId: editSessionId,
        lockStrategy: "last-opener-wins",
        wasLockHolder: true,
        userEmail: decryptedUser.email,
        userMobile: decryptedUser.mobile,
      },
    });

    console.log(
      `✅ UPDATE COMPLETE: Admin ${adminUser.username} updated ${decryptedUser.firstName} ${decryptedUser.lastName}`,
    );
    console.log(`Lock released for session: ${editSessionId}`);

    res.status(200).json({
      success: true,
      message: "User account updated successfully",
      serverTimestamp: updateData.lastUpdateTimestamp,
      hadConflict: hasConflict,
      lockReleased: true,
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
        adminUser.password,
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

      // Decrypt for logging
      const decryptedUser = encryptionService.decryptObject(targetUser, [
        "email",
        "mobile",
      ]);

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
        },
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
          userName: `${decryptedUser.firstName} ${decryptedUser.lastName}`,
          userUsername: decryptedUser.username,
          userEmail: decryptedUser.email,
          userMobile: decryptedUser.mobile,
        },
      });

      console.log(
        `⚡ Performed action: archive_user_account for ${decryptedUser.firstName} ${decryptedUser.lastName}`,
      );
      console.log(
        `Admin: ${adminUser.username} | User: ${decryptedUser.firstName} ${decryptedUser.lastName} (${decryptedUser.username}) | Email: ${decryptedUser.email} | Action: archive_user_account | ID: ${logResult.insertedId}`,
      );
      console.log(
        `${new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`,
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
  },
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
        adminUser.password,
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

      // Decrypt for logging
      const decryptedUser = encryptionService.decryptObject(targetUser, [
        "email",
        "mobile",
      ]);

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
        },
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
          userName: `${decryptedUser.firstName} ${decryptedUser.lastName}`,
          userUsername: decryptedUser.username,
          userEmail: decryptedUser.email,
          userMobile: decryptedUser.mobile,
        },
      });

      console.log(
        `⚡ Performed action: unarchive_user_account for ${decryptedUser.firstName} ${decryptedUser.lastName}`,
      );
      console.log(
        `Admin: ${adminUser.username} | User: ${decryptedUser.firstName} ${decryptedUser.lastName} (${decryptedUser.username}) | Email: ${decryptedUser.email} | Action: unarchive_user_account | ID: ${logResult.insertedId}`,
      );
      console.log(
        `${new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`,
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
  },
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

      // For searching encrypted fields, we need to get all users and decrypt them for searching
      const users = await usersCollection
        .find(
          {
            isAdmin: { $ne: true }, // Exclude admin accounts
          },
          {
            projection: {
              password: 0,
              googleId: 0,
              facebookId: 0,
            },
          },
        )
        .sort({ createdAt: -1 })
        .toArray();

      // Decrypt all users and filter by search term
      const decryptedUsers = users.map((user) =>
        encryptionService.decryptObject(user, ["email", "mobile"]),
      );

      const searchRegex = new RegExp(searchTerm, "i");
      const filteredUsers = decryptedUsers.filter((user) => {
        return (
          searchRegex.test(user.firstName) ||
          searchRegex.test(user.lastName) ||
          searchRegex.test(user.email) ||
          searchRegex.test(user.username) ||
          searchRegex.test(user.mobile)
        );
      });

      res.status(200).json({
        success: true,
        users: filteredUsers,
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
  },
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
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    // Decrypt sensitive data
    const decryptedAdmins = admins.map((admin) =>
      encryptionService.decryptObject(admin, ["email", "mobile"]),
    );

    res.status(200).json({
      success: true,
      admins: decryptedAdmins,
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
      adminUser.password,
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

    // Decrypt for logging
    const decryptedUserToPromote = encryptionService.decryptObject(
      userToPromote,
      ["email", "mobile"],
    );

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
      { $set: updateData },
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
        targetUserName: `${decryptedUserToPromote.firstName} ${decryptedUserToPromote.lastName}`,
        targetUserUsername: decryptedUserToPromote.username,
        targetUserEmail: decryptedUserToPromote.email,
        targetUserMobile: decryptedUserToPromote.mobile,
        role: role,
        newRole: role === "assistant" ? "Assistant Admin" : "Full Admin",
      },
    });

    console.log(
      `⚡ Performed action: promote_to_admin for ${decryptedUserToPromote.firstName} ${decryptedUserToPromote.lastName}`,
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${decryptedUserToPromote.firstName} ${decryptedUserToPromote.lastName} (${decryptedUserToPromote.username}) | Email: ${decryptedUserToPromote.email} | Action: promote_to_admin | ID: ${logResult.insertedId}`,
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`,
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
      adminUser.password,
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

    // Decrypt for logging
    const decryptedTargetAdmin = encryptionService.decryptObject(targetAdmin, [
      "email",
      "mobile",
    ]);

    // Update admin role
    const updateData = {
      isAssistant: role === "assistant",
      updatedAt: new Date(),
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(adminId) },
      { $set: updateData },
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
        targetUserName: `${decryptedTargetAdmin.firstName} ${decryptedTargetAdmin.lastName}`,
        targetUserUsername: decryptedTargetAdmin.username,
        targetUserEmail: decryptedTargetAdmin.email,
        targetUserMobile: decryptedTargetAdmin.mobile,
        oldRole: targetAdmin.isAssistant ? "Assistant Admin" : "Full Admin",
        newRole: role === "assistant" ? "Assistant Admin" : "Full Admin",
      },
    });

    console.log(
      `⚡ Performed action: change_admin_role for ${decryptedTargetAdmin.firstName} ${decryptedTargetAdmin.lastName}`,
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${decryptedTargetAdmin.firstName} ${decryptedTargetAdmin.lastName} (${decryptedTargetAdmin.username}) | Email: ${decryptedTargetAdmin.email} | Action: change_admin_role | ID: ${logResult.insertedId}`,
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`,
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
      adminUser.password,
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

    // Decrypt for logging
    const decryptedTargetAdmin = encryptionService.decryptObject(targetAdmin, [
      "email",
      "mobile",
    ]);

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
      { $set: updateData },
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
        targetUserName: `${decryptedTargetAdmin.firstName} ${decryptedTargetAdmin.lastName}`,
        targetUserUsername: decryptedTargetAdmin.username,
        targetUserEmail: decryptedTargetAdmin.email,
        targetUserMobile: decryptedTargetAdmin.mobile,
        oldRole: targetAdmin.isAssistant ? "Assistant Admin" : "Full Admin",
      },
    });

    console.log(
      `⚡ Performed action: revoke_admin_privileges for ${decryptedTargetAdmin.firstName} ${decryptedTargetAdmin.lastName}`,
    );
    console.log(
      `Admin: ${adminUser.username} | User: ${decryptedTargetAdmin.firstName} ${decryptedTargetAdmin.lastName} (${decryptedTargetAdmin.username}) | Email: ${decryptedTargetAdmin.email} | Action: revoke_admin_privileges | ID: ${logResult.insertedId}`,
    );
    console.log(
      `${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`,
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
