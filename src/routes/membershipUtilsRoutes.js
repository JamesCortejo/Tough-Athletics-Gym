const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const {
  getMembershipStatus,
  getUserMembershipSummary,
  getAllMembershipsWithStatus,
  updateExpiredMemberships,
} = require("../utils/membershipDateUtils");
const { verifyToken } = require("../handlers/loginHandler");

// Get membership status for a specific membership
router.get("/status/:membershipId", verifyToken, async (req, res) => {
  try {
    const { membershipId } = req.params;
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const membership = await membershipsCollection.findOne({
      _id: new ObjectId(membershipId),
    });

    const statusInfo = getMembershipStatus(membership);

    res.status(200).json({
      success: true,
      membership: membership,
      status: statusInfo,
    });
  } catch (error) {
    console.error("Get membership status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get user membership summary
router.get("/user-summary/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await getUserMembershipSummary(userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get user membership summary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get current user membership summary
router.get("/current-user-summary", verifyToken, async (req, res) => {
  try {
    const result = await getUserMembershipSummary(req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Get current user membership summary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all memberships with calculated status (for admin dashboard)
router.get("/admin/all-with-status", verifyToken, async (req, res) => {
  try {
    const result = await getAllMembershipsWithStatus();

    res.status(200).json(result);
  } catch (error) {
    console.error("Get all memberships with status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Manually trigger expired membership update
router.post("/admin/update-expired", verifyToken, async (req, res) => {
  try {
    const result = await updateExpiredMemberships();

    res.status(200).json(result);
  } catch (error) {
    console.error("Update expired memberships error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
