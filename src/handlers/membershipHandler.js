const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");

async function registerMembership(membershipData) {
  console.log("Received membership data:", membershipData);

  try {
    const { userId, planType, paymentMethod } = membershipData;

    // Basic validation
    if (!userId || !planType) {
      throw new Error("User ID and plan type are required");
    }

    const db = await connectToDatabase();
    console.log("Database connected successfully for membership registration");

    const usersCollection = db.collection("users");
    const membershipsCollection = db.collection("memberships");

    // Verify user exists and get complete user data
    let user;
    try {
      user = await usersCollection.findOne({
        _id: new ObjectId(userId),
      });
    } catch (error) {
      throw new Error("Invalid user ID format");
    }

    if (!user) {
      throw new Error("User not found");
    }

    // Get user information for membership
    const qrCodeId = user.qrCodeId;
    const firstName = user.firstName;
    const lastName = user.lastName;
    const email = user.email;
    const phone = user.mobile;
    const profilePicture = user.profilePicture;

    if (!qrCodeId) {
      throw new Error(
        "User does not have a QR code ID. Please contact support."
      );
    }

    console.log("User found for membership:", {
      username: user.username,
      firstName: firstName,
      lastName: lastName,
      qrCodeId: qrCodeId,
    });

    // Enhanced check for existing memberships
    const existingMemberships = await membershipsCollection
      .find({
        qrCodeId: qrCodeId,
        status: { $in: ["Pending", "Active"] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    if (existingMemberships && existingMemberships.length > 0) {
      const activeMembership = existingMemberships.find(
        (m) => m.status === "Active"
      );
      const pendingMembership = existingMemberships.find(
        (m) => m.status === "Pending"
      );

      if (activeMembership) {
        const endDate = new Date(activeMembership.endDate).toLocaleDateString();
        throw new Error(
          `You already have an active ${activeMembership.planType} membership that ends on ${endDate}. Please wait until your current membership expires before applying for a new one.`
        );
      }

      if (pendingMembership) {
        const appliedDate = new Date(
          pendingMembership.appliedAt
        ).toLocaleDateString();
        throw new Error(
          `You already have a pending ${pendingMembership.planType} membership application submitted on ${appliedDate}. Please wait for admin approval before applying for a new membership.`
        );
      }
    }

    // Calculate membership dates (will be set to active dates when approved)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);

    // Calculate end date based on plan type
    switch (planType) {
      case "Basic":
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case "Premium":
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case "VIP":
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      default:
        throw new Error("Invalid plan type");
    }

    endDate.setHours(23, 59, 59, 999);

    // Prepare enhanced membership document with user information
    const membershipDocument = {
      userId: new ObjectId(userId),
      qrCodeId: qrCodeId,
      planType: planType,

      // User personal information
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      profilePicture: profilePicture,

      // Membership details - dates will be set when approved
      startDate: null, // Will be set when admin approves
      endDate: null, // Will be set when admin approves
      paymentMethod: paymentMethod || "Cash at Gym",
      status: "Pending",
      amount: getMembershipAmount(planType),
      appliedAt: new Date(), // Track when application was submitted
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      "Attempting to insert pending membership document:",
      membershipDocument
    );

    // Insert membership into database
    const result = await membershipsCollection.insertOne(membershipDocument);
    console.log("Membership insert result:", result);

    // Verify the document was inserted
    const insertedMembership = await membershipsCollection.findOne({
      _id: result.insertedId,
    });
    console.log("Verified inserted membership:", insertedMembership);

    return {
      success: true,
      message:
        "Membership application submitted successfully! Please wait for admin approval.",
      membershipId: result.insertedId,
      status: "Pending",
      planType: planType,
    };
  } catch (error) {
    console.error("Membership registration error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Helper function to get membership amount
function getMembershipAmount(planType) {
  switch (planType) {
    case "Basic":
      return 500;
    case "Premium":
      return 1200;
    case "VIP":
      return 2000;
    default:
      return 0;
  }
}

// Get user's current membership (only active ones)
async function getUserMembership(userId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const membership = await membershipsCollection.findOne({
      userId: new ObjectId(userId),
      status: "Active",
    });

    return membership;
  } catch (error) {
    console.error("Error getting user membership:", error);
    return null;
  }
}

// Get user's pending membership
async function getUserPendingMembership(userId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const membership = await membershipsCollection.findOne({
      userId: new ObjectId(userId),
      status: "Pending",
    });

    return membership;
  } catch (error) {
    console.error("Error getting user pending membership:", error);
    return null;
  }
}

// Get all memberships for a user
async function getUserMembershipHistory(userId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const memberships = await membershipsCollection
      .find({
        userId: new ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return memberships;
  } catch (error) {
    console.error("Error getting user membership history:", error);
    return [];
  }
}

// Get user's membership status (for frontend validation)
async function getUserMembershipStatus(userId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const memberships = await membershipsCollection
      .find({
        userId: new ObjectId(userId),
        status: { $in: ["Pending", "Active"] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    return {
      hasActive: memberships.some((m) => m.status === "Active"),
      hasPending: memberships.some((m) => m.status === "Pending"),
      activeMembership: memberships.find((m) => m.status === "Active"),
      pendingMembership: memberships.find((m) => m.status === "Pending"),
      allMemberships: memberships,
    };
  } catch (error) {
    console.error("Error getting user membership status:", error);
    return {
      hasActive: false,
      hasPending: false,
      activeMembership: null,
      pendingMembership: null,
      allMemberships: [],
    };
  }
}

// Get all pending memberships (for admin)
async function getAllPendingMemberships() {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const memberships = await membershipsCollection
      .find({
        status: "Pending",
      })
      .sort({ appliedAt: -1 })
      .toArray();

    return memberships;
  } catch (error) {
    console.error("Error getting all pending memberships:", error);
    return [];
  }
}

// Get all active memberships (for admin)
async function getAllActiveMemberships() {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const memberships = await membershipsCollection
      .find({
        status: "Active",
      })
      .sort({ createdAt: -1 })
      .toArray();

    return memberships;
  } catch (error) {
    console.error("Error getting all active memberships:", error);
    return [];
  }
}

module.exports = {
  registerMembership,
  getUserMembership,
  getUserPendingMembership,
  getUserMembershipHistory,
  getUserMembershipStatus,
  getAllPendingMemberships,
  getAllActiveMemberships,
};
