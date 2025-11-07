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

    // NEW: Check if admin is assistant and send role info
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
      // NEW: Send admin role info to frontend
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

    // NEW: Check if admin is assistant
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
      // NEW: Send admin role info to frontend
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

// Update user account - UPDATED with password confirmation and assistant restriction
router.put("/admin/accounts/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { updateData, adminPassword, confirmText } = req.body;
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

    // NEW: Check if admin is assistant
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

    // Log admin action
    await db.collection("admin_actions").insertOne({
      action: "update_user_account",
      targetUserId: new ObjectId(userId),
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: "admin", // NEW: Log the role
      timestamp: new Date(),
      details: {
        updatedFields: Object.keys(updateData),
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

      // NEW: Check if admin is assistant
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
        adminRole: "admin", // NEW: Log the role
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

      // NEW: Check if admin is assistant
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
        adminRole: "admin", // NEW: Log the role
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
        // NEW: Send admin role info to frontend
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

module.exports = router;
