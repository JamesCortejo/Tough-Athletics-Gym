const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyAdminToken } = require("../handlers/adminLoginHandler");
const { verifyToken } = require("../handlers/loginHandler");
const { checkinMember, recordCheckin } = require("../handlers/checkinHandler");
const encryptionService = require("../utils/encryptionService");

// Get check-ins for a specific membership (for user)
router.get("/checkins/:membershipId", verifyToken, async (req, res) => {
  try {
    const { membershipId } = req.params;
    const db = await connectToDatabase();
    const usercheckinCollection = db.collection("usercheckin");

    const checkins = await usercheckinCollection
      .find({
        membershipId: new ObjectId(membershipId),
      })
      .sort({ checkinTime: -1 })
      .toArray();

    res.json({
      success: true,
      checkins: checkins,
    });
  } catch (error) {
    console.error("Error fetching check-ins:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Check-in member by QR code
router.post("/checkin/:qrCodeId", verifyAdminToken, async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const result = await checkinMember(qrCodeId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Record check-in in database - FIXED VERSION
router.post("/record-checkin", verifyAdminToken, async (req, res) => {
  try {
    const checkinData = req.body;

    console.log("🔍 Record check-in request received:", {
      checkinData: {
        qrCodeId: checkinData.qrCodeId,
        membershipId: checkinData.membershipId,
        firstName: checkinData.firstName,
        lastName: checkinData.lastName,
        email: checkinData.email,
        phone: checkinData.phone,
      },
      adminUser: req.admin, // Log the admin data from token
    });

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Get admin user details for logging
    const adminUser = await usersCollection.findOne({
      _id: new ObjectId(req.admin.userId),
      isAdmin: true,
    });

    console.log("🔍 Admin user found:", {
      adminId: req.admin.userId,
      adminUserFound: !!adminUser,
      username: adminUser?.username,
    });

    if (!adminUser) {
      console.error("❌ Admin user not found in database");
    }

    const adminInfo = {
      userId: req.admin.userId,
      username: adminUser?.username || "Unknown Admin",
    };

    // Decrypt checkin data if it contains encrypted fields
    const decryptedCheckinData = {
      ...checkinData,
      email: checkinData.email
        ? encryptionService.decrypt(checkinData.email)
        : null,
      phone: checkinData.phone
        ? encryptionService.decrypt(checkinData.phone)
        : null,
    };

    console.log("🔍 Decrypted check-in data:", {
      email: decryptedCheckinData.email,
      phone: decryptedCheckinData.phone,
    });

    // Pass adminInfo to recordCheckin
    const result = await recordCheckin(decryptedCheckinData, adminInfo);

    console.log("✅ Record check-in result:", result);

    res.json(result);
  } catch (error) {
    console.error("❌ Error in record-checkin route:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
