// src/routes/nonMemberRoutes.js
const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");

// Get all non-members
router.get("/non-members", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const nonMembersCollection = db.collection("nonmembers");
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

    // Get all non-members sorted by check-in time (newest first)
    const nonMembers = await nonMembersCollection
      .find({})
      .sort({ checkInTime: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      nonMembers: nonMembers,
    });
  } catch (error) {
    console.error("Get non-members error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Add new non-member
router.post("/non-members", verifyToken, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      phone,
      email,
      address,
      paymentMethod,
      amount,
    } = req.body;
    const db = await connectToDatabase();
    const nonMembersCollection = db.collection("nonmembers");
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

    // Create non-member document (removed checkedByAdmin and adminRole fields)
    const nonMemberData = {
      firstName,
      lastName,
      gender,
      phone,
      email: email || null,
      address,
      paymentMethod: paymentMethod || "Cash at Gym",
      amount: amount || 75,
      checkInTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert into database
    const result = await nonMembersCollection.insertOne(nonMemberData);

    // Log admin action in admin_actions collection - FIXED STRUCTURE
    await db.collection("admin_actions").insertOne({
      action: "add_walkin_customer",
      adminId: new ObjectId(req.user.userId),
      adminName: adminUser.username,
      adminRole: adminUser.isAssistant ? "assistant" : "admin",
      walkinCheckinId: result.insertedId, // ADD THIS - crucial for linking
      walkinCustomerName: `${firstName} ${lastName}`, // TOP LEVEL FIELD
      walkinCustomerPhone: phone, // TOP LEVEL FIELD
      walkinCustomerEmail: email, // TOP LEVEL FIELD
      amount: amount || 75, // TOP LEVEL FIELD
      paymentMethod: paymentMethod || "Cash at Gym", // TOP LEVEL FIELD
      timestamp: new Date(),
      details: {
        type: "walkin_checkin",
        manualEntry: true,
        // Keep the nested details for backward compatibility if needed
        customerName: `${firstName} ${lastName}`,
        phone: phone,
        amount: amount || 75,
        paymentMethod: paymentMethod || "Cash at Gym",
        nonMemberId: result.insertedId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Walk-in customer added successfully",
      nonMemberId: result.insertedId,
    });
  } catch (error) {
    console.error("Add non-member error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Search non-members
router.get("/non-members/search/:searchTerm", verifyToken, async (req, res) => {
  try {
    const { searchTerm } = req.params;
    const db = await connectToDatabase();
    const nonMembersCollection = db.collection("nonmembers");
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

    const nonMembers = await nonMembersCollection
      .find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { address: searchRegex },
        ],
      })
      .sort({ checkInTime: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      nonMembers: nonMembers,
    });
  } catch (error) {
    console.error("Search non-members error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
