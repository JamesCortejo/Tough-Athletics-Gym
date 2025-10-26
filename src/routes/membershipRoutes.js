const express = require("express");
const router = express.Router();
const {
  registerMembership,
  getUserMembership,
  getUserPendingMembership,
  getUserMembershipHistory,
  getUserMembershipStatus,
  getAllPendingMemberships,
  getAllActiveMemberships,
} = require("../handlers/membershipHandler");
const { verifyToken } = require("../handlers/loginHandler");

// Apply for membership
router.post("/apply", verifyToken, async (req, res) => {
  try {
    console.log("User from token:", req.user);

    const { planType, paymentMethod } = req.body;

    const membershipData = {
      userId: req.user.userId,
      planType: planType,
      paymentMethod: paymentMethod,
    };

    console.log("Processing membership application:", membershipData);

    const result = await registerMembership(membershipData);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Membership application error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get current active membership
router.get("/current", verifyToken, async (req, res) => {
  try {
    const membership = await getUserMembership(req.user.userId);

    if (membership) {
      res.status(200).json({
        success: true,
        membership: membership,
      });
    } else {
      res.status(200).json({
        success: true,
        membership: null,
        message: "No active membership found",
      });
    }
  } catch (error) {
    console.error("Get membership error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get pending membership
router.get("/pending", verifyToken, async (req, res) => {
  try {
    const membership = await getUserPendingMembership(req.user.userId);

    if (membership) {
      res.status(200).json({
        success: true,
        membership: membership,
      });
    } else {
      res.status(200).json({
        success: true,
        membership: null,
        message: "No pending membership found",
      });
    }
  } catch (error) {
    console.error("Get pending membership error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get membership status (for frontend validation)
router.get("/status", verifyToken, async (req, res) => {
  try {
    const status = await getUserMembershipStatus(req.user.userId);

    res.status(200).json({
      success: true,
      status: status,
    });
  } catch (error) {
    console.error("Get membership status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get membership history
router.get("/history", verifyToken, async (req, res) => {
  try {
    const memberships = await getUserMembershipHistory(req.user.userId);

    res.status(200).json({
      success: true,
      memberships: memberships,
    });
  } catch (error) {
    console.error("Get membership history error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all pending memberships (for admin)
router.get("/admin/pending", verifyToken, async (req, res) => {
  try {
    // You might want to add admin verification here
    const memberships = await getAllPendingMemberships();

    res.status(200).json({
      success: true,
      memberships: memberships,
    });
  } catch (error) {
    console.error("Get all pending memberships error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all active memberships (for admin)
router.get("/admin/active", verifyToken, async (req, res) => {
  try {
    // You might want to add admin verification here
    const memberships = await getAllActiveMemberships();

    res.status(200).json({
      success: true,
      memberships: memberships,
    });
  } catch (error) {
    console.error("Get all active memberships error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
