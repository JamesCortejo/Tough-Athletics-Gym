const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyAdminToken } = require("../handlers/adminLoginHandler");
const bcrypt = require("bcryptjs");

// Get all active members with their details
router.get("/active-members", verifyAdminToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");
    const usersCollection = db.collection("users");
    const usercheckinCollection = db.collection("usercheckin");

    // Find all active memberships
    const activeMemberships = await membershipsCollection
      .find({
        status: "Active",
        endDate: { $gte: new Date() }, // Only memberships that haven't expired
      })
      .sort({ firstName: 1, lastName: 1 })
      .toArray();

    // Enrich with user data and check-in information
    const membersWithDetails = await Promise.all(
      activeMemberships.map(async (membership) => {
        // Get user profile picture and additional info including QR code image
        const user = await usersCollection.findOne({
          _id: new ObjectId(membership.userId),
        });

        console.log("🔍 User data for QR code:", {
          userId: membership.userId,
          userFound: !!user,
          qrCodePicture: user?.qrCodePicture,
          profilePicture: user?.profilePicture,
        });

        // Calculate remaining days
        const today = new Date();
        const endDate = new Date(membership.endDate);
        const remainingDays = Math.ceil(
          (endDate - today) / (1000 * 60 * 60 * 24)
        );

        // Get check-in statistics
        const checkins = await usercheckinCollection
          .find({
            membershipId: new ObjectId(membership._id),
          })
          .sort({ checkinTime: -1 })
          .toArray();

        const totalCheckins = checkins.length;

        // Calculate missed check-ins
        const missedCheckins = calculateMissedCheckins(membership, checkins);

        return {
          _id: membership._id,
          firstName: membership.firstName,
          lastName: membership.lastName,
          email: membership.email,
          phone: membership.phone,
          profilePicture: user?.profilePicture || "/images/default-profile.png",
          qrCodePicture: user?.qrCodePicture, // This might be null if not exists
          qrCodeId: membership.qrCodeId,
          planType: membership.planType,
          startDate: membership.startDate,
          endDate: membership.endDate,
          remainingDays: remainingDays > 0 ? remainingDays : 0,
          totalCheckins: totalCheckins,
          missedCheckins: missedCheckins,
          lastCheckin: checkins[0]?.checkinTime || null,
          userId: membership.userId,
        };
      })
    );

    res.json({
      success: true,
      members: membersWithDetails,
      totalCount: membersWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching active members:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get detailed member information including check-in history
router.get(
  "/member-details/:membershipId",
  verifyAdminToken,
  async (req, res) => {
    try {
      const { membershipId } = req.params;
      const db = await connectToDatabase();
      const membershipsCollection = db.collection("memberships");
      const usersCollection = db.collection("users");
      const usercheckinCollection = db.collection("usercheckin");

      // Get membership details
      const membership = await membershipsCollection.findOne({
        _id: new ObjectId(membershipId),
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: "Membership not found",
        });
      }

      console.log("🔍 Fetching member details for:", {
        membershipId: membershipId,
        userId: membership.userId,
        qrCodeId: membership.qrCodeId,
      });

      // Get user details including QR code picture
      const user = await usersCollection.findOne({
        _id: new ObjectId(membership.userId),
      });

      console.log("🔍 User details found:", {
        userFound: !!user,
        qrCodePicture: user?.qrCodePicture,
        hasProfilePicture: !!user?.profilePicture,
      });

      // Get all check-ins for this membership
      const checkins = await usercheckinCollection
        .find({
          membershipId: new ObjectId(membershipId),
        })
        .sort({ checkinTime: -1 })
        .toArray();

      // Calculate unique check-in days (not total check-ins)
      const uniqueCheckinDates = new Set();
      checkins.forEach((checkin) => {
        const checkinDate = new Date(checkin.checkinTime);
        checkinDate.setHours(0, 0, 0, 0);
        uniqueCheckinDates.add(checkinDate.toISOString().split("T")[0]);
      });

      const totalUniqueCheckins = uniqueCheckinDates.size;
      const missedCheckins = calculateMissedCheckins(membership, checkins);

      // Calculate total possible check-in days
      const startDate = new Date(membership.startDate);
      const today = new Date();
      const endDate = new Date(Math.min(today, new Date(membership.endDate)));

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      let totalPossibleDays = 0;
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        totalPossibleDays++;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Check-in rate based on unique check-in days
      const checkinRate =
        totalPossibleDays > 0
          ? Math.round((totalUniqueCheckins / totalPossibleDays) * 100)
          : 0;

      const memberDetails = {
        membership: membership,
        user: user || {},
        checkins: checkins,
        statistics: {
          totalCheckins: totalUniqueCheckins, // Use unique days, not total records
          missedCheckins: missedCheckins,
          checkinRate: checkinRate,
          totalPossibleDays: totalPossibleDays, // For debugging
        },
      };

      res.json({
        success: true,
        memberDetails: memberDetails,
      });
    } catch (error) {
      console.error("Error fetching member details:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Get QR code image directly
router.get("/qr-code-image/:userId", verifyAdminToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user || !user.qrCodePicture) {
      return res.status(404).json({
        success: false,
        message: "QR code image not found",
      });
    }

    res.json({
      success: true,
      qrCodePicture: user.qrCodePicture,
    });
  } catch (error) {
    console.error("Error fetching QR code image:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Verify admin password for security confirmation
router.post("/verify-password", verifyAdminToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    console.log("🔍 Looking for admin user with ID:", req.admin.userId);

    // Get the admin user from the database using the admin ID from the token
    const adminUser = await usersCollection.findOne({
      _id: new ObjectId(req.admin.userId),
      isAdmin: true,
    });

    if (!adminUser) {
      console.log("❌ Admin user not found in database");
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    console.log("✅ Admin user found:", adminUser.username);

    // Verify the password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, adminUser.password);

    if (isPasswordValid) {
      console.log("✅ Password verified successfully");
      res.json({
        success: true,
        message: "Password verified successfully",
      });
    } else {
      console.log("❌ Invalid password provided");
      res.status(401).json({
        success: false,
        message: "Invalid admin password",
      });
    }
  } catch (error) {
    console.error("Error verifying password:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Extend membership
router.post("/members/:memberId/extend", verifyAdminToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { months, newEndDate } = req.body;

    if (!months || !newEndDate) {
      return res.status(400).json({
        success: false,
        message: "Months and new end date are required",
      });
    }

    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    // Update the membership end date
    const result = await membershipsCollection.updateOne(
      { _id: new ObjectId(memberId) },
      {
        $set: {
          endDate: new Date(newEndDate),
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Membership not found or no changes made",
      });
    }

    // Get admin details for logging
    const usersCollection = db.collection("users");
    const adminUser = await usersCollection.findOne({
      _id: new ObjectId(req.admin.userId),
      isAdmin: true,
    });

    // Log the action
    await db.collection("admin_actions").insertOne({
      action: "extend_membership",
      membershipId: new ObjectId(memberId),
      months: months,
      newEndDate: new Date(newEndDate),
      adminId: req.admin.userId,
      adminName: adminUser?.username || "Unknown Admin",
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Membership extended by ${months} month(s) successfully`,
    });
  } catch (error) {
    console.error("Error extending membership:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Change membership plan
router.post(
  "/members/:memberId/change-plan",
  verifyAdminToken,
  async (req, res) => {
    try {
      const { memberId } = req.params;
      const { newPlan, startDate, endDate } = req.body;

      if (!newPlan || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "New plan, start date, and end date are required",
        });
      }

      const db = await connectToDatabase();
      const membershipsCollection = db.collection("memberships");

      // Get current membership to compare changes
      const currentMembership = await membershipsCollection.findOne({
        _id: new ObjectId(memberId),
      });

      if (!currentMembership) {
        return res.status(404).json({
          success: false,
          message: "Membership not found",
        });
      }

      // Update the membership plan and dates
      const result = await membershipsCollection.updateOne(
        { _id: new ObjectId(memberId) },
        {
          $set: {
            planType: newPlan,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "No changes made to membership",
        });
      }

      // Get admin details for logging
      const usersCollection = db.collection("users");
      const adminUser = await usersCollection.findOne({
        _id: new ObjectId(req.admin.userId),
        isAdmin: true,
      });

      // Log the action
      await db.collection("admin_actions").insertOne({
        action: "change_plan",
        membershipId: new ObjectId(memberId),
        oldPlan: currentMembership.planType,
        newPlan: newPlan,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        adminId: req.admin.userId,
        adminName: adminUser?.username || "Unknown Admin",
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: `Membership plan changed to ${newPlan} successfully`,
      });
    } catch (error) {
      console.error("Error changing membership plan:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Withdraw membership
router.post(
  "/members/:memberId/withdraw",
  verifyAdminToken,
  async (req, res) => {
    try {
      const { memberId } = req.params;

      const db = await connectToDatabase();
      const membershipsCollection = db.collection("memberships");

      // Get current membership details for logging
      const currentMembership = await membershipsCollection.findOne({
        _id: new ObjectId(memberId),
      });

      if (!currentMembership) {
        return res.status(404).json({
          success: false,
          message: "Membership not found",
        });
      }

      // Update membership status to expired and set end date to today
      const result = await membershipsCollection.updateOne(
        { _id: new ObjectId(memberId) },
        {
          $set: {
            status: "Expired",
            endDate: new Date(), // Set to current date
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "No changes made to membership",
        });
      }

      // Get admin details for logging
      const usersCollection = db.collection("users");
      const adminUser = await usersCollection.findOne({
        _id: new ObjectId(req.admin.userId),
        isAdmin: true,
      });

      // Log the action
      await db.collection("admin_actions").insertOne({
        action: "withdraw_membership",
        membershipId: new ObjectId(memberId),
        memberName: `${currentMembership.firstName} ${currentMembership.lastName}`,
        oldEndDate: currentMembership.endDate,
        adminId: req.admin.userId,
        adminName: adminUser?.username || "Unknown Admin",
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Membership withdrawn successfully",
      });
    } catch (error) {
      console.error("Error withdrawing membership:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Accurate missed check-ins calculation
function calculateMissedCheckins(membership, checkins) {
  const startDate = new Date(membership.startDate);
  const today = new Date();

  // Don't count future dates beyond today or end date
  const endDate = new Date(Math.min(today, new Date(membership.endDate)));

  // Reset times to avoid timezone issues
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  today.setHours(23, 59, 59, 999);

  // Create a Set of unique check-in dates for fast lookup
  const checkinDatesSet = new Set();

  checkins.forEach((checkin) => {
    const checkinDate = new Date(checkin.checkinTime);
    checkinDate.setHours(0, 0, 0, 0);
    const dateString = checkinDate.toISOString().split("T")[0];
    checkinDatesSet.add(dateString);
  });

  // Count actual missed days (days without check-ins)
  let missedDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split("T")[0];

    // If this date doesn't have a check-in, count it as missed
    if (!checkinDatesSet.has(dateString)) {
      missedDays++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return missedDays;
}

module.exports = router;
