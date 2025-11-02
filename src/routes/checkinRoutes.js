const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyAdminToken } = require("../handlers/adminLoginHandler");
const { verifyToken } = require("../handlers/loginHandler");
const { checkinMember, recordCheckin } = require("../handlers/checkinHandler");

// Get check-ins for a specific membership (for user)
router.get("/checkins/:membershipId", verifyToken, async (req, res) => {
  try {
    const { membershipId } = req.params;
    const db = await connectToDatabase();
    const usercheckinCollection = db.collection("usercheckin");

    // Get all check-ins for this membership, sorted by date (newest first)
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

// Record check-in in database
router.post("/record-checkin", verifyAdminToken, async (req, res) => {
  try {
    const checkinData = req.body;
    const result = await recordCheckin(checkinData);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
