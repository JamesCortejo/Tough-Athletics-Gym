const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const {
  registerMembership,
  getUserMembership,
  getUserPendingMembership,
  getUserMembershipHistory,
  getUserMembershipStatus,
  getAllPendingMemberships,
  getAllActiveMemberships,
  approveMembership,
  declineMembership,
  getMembershipApplication,
} = require("../handlers/membershipHandler");
const { verifyToken } = require("../handlers/loginHandler");

// Decline pending membership (admin only)
router.post("/admin/decline/:membershipId", verifyToken, async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason for decline is required",
      });
    }

    const result = await declineMembership(membershipId, reason.trim());

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Decline membership error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

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

// Get membership status
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

// Get specific membership application details (admin)
router.get(
  "/admin/application/:membershipId",
  verifyToken,
  async (req, res) => {
    try {
      const { membershipId } = req.params;

      const application = await getMembershipApplication(membershipId);

      if (application) {
        res.status(200).json({
          success: true,
          application: application,
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }
    } catch (error) {
      console.error("Get application details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Approve pending membership (admin only)
router.post("/admin/approve/:membershipId", verifyToken, async (req, res) => {
  try {
    const { membershipId } = req.params;

    const result = await approveMembership(membershipId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Approve membership error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all pending applications with user details (for admin dashboard)
router.get("/admin/pending-applications", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");
    const usersCollection = db.collection("users");

    // Get pending memberships and join with user data
    const pendingMemberships = await membershipsCollection
      .aggregate([
        {
          $match: { status: "Pending" },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $project: {
            _id: 1,
            planType: 1,
            paymentMethod: 1,
            amount: 1,
            appliedAt: 1,
            status: 1,
            firstName: "$user.firstName",
            lastName: "$user.lastName",
            email: "$user.email",
            phone: "$user.mobile",
            profilePicture: "$user.profilePicture",
            qrCodeId: "$user.qrCodeId",
          },
        },
        {
          $sort: { appliedAt: -1 },
        },
      ])
      .toArray();

    res.status(200).json({
      success: true,
      applications: pendingMemberships,
    });
  } catch (error) {
    console.error("Get pending applications error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
