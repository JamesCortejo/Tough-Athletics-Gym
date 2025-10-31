const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { calculateEndDate } = require("../utils/membershipDateUtils");
const { createNotification } = require("./notificationHandler");

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

    // Calculate membership dates using utility function
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = calculateEndDate(startDate, planType);

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

      // Membership details
      startDate: startDate,
      endDate: endDate,
      paymentMethod: paymentMethod || "Cash at Gym",
      status: "Pending",
      amount: getMembershipAmount(planType),
      appliedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      "Attempting to insert membership document with dates:",
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

    // Send notification to user about application submission
    try {
      const notificationResult = await createNotification({
        userId: userId,
        title: "📋 Membership Application Submitted",
        message: `Your ${planType} membership application has been received and is pending admin approval.`,
        type: "info",
        relatedId: result.insertedId.toString(),
      });
      console.log("Application submission notification:", notificationResult);
    } catch (notificationError) {
      console.error(
        "Failed to send application notification:",
        notificationError
      );
      // Don't throw error, just log it
    }

    return {
      success: true,
      message:
        "Membership application submitted successfully! Please wait for admin approval.",
      membershipId: result.insertedId,
      status: "Pending",
      planType: planType,
      startDate: startDate,
      endDate: endDate,
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

// Get specific membership application details
async function getMembershipApplication(membershipId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const membership = await membershipsCollection.findOne({
      _id: new ObjectId(membershipId),
    });

    return membership;
  } catch (error) {
    console.error("Error getting membership application:", error);
    return null;
  }
}

// Admin function to approve a pending membership
async function approveMembership(membershipId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    // First get the membership to get the plan type and user ID
    const membership = await membershipsCollection.findOne({
      _id: new ObjectId(membershipId),
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    // Calculate new start and end dates based on current date
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Set to start of day

    const endDate = calculateEndDate(startDate, membership.planType);

    const result = await membershipsCollection.updateOne(
      {
        _id: new ObjectId(membershipId),
        status: "Pending",
      },
      {
        $set: {
          status: "Active",
          startDate: startDate,
          endDate: endDate,
          updatedAt: new Date(),
          approvedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error("Membership not found or already approved");
    }

    // Send notification to user about approval
    try {
      const notificationResult = await createNotification({
        userId: membership.userId,
        title: "🎉 Membership Approved!",
        message: `Your ${
          membership.planType
        } membership application has been approved and is now active. Welcome to Tough Athletics Gym! Your membership is valid until ${endDate.toLocaleDateString()}.`,
        type: "success",
        relatedId: membershipId,
      });
      console.log("Membership approval notification:", notificationResult);
    } catch (notificationError) {
      console.error("Failed to send approval notification:", notificationError);
      // Don't throw error, just log it
    }

    return {
      success: true,
      message: "Membership approved successfully",
      startDate: startDate,
      endDate: endDate,
    };
  } catch (error) {
    console.error("Error approving membership:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Decline pending membership (admin only)
async function declineMembership(membershipId, reason) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    // First get the membership to get user ID
    const membership = await membershipsCollection.findOne({
      _id: new ObjectId(membershipId),
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    const result = await membershipsCollection.updateOne(
      {
        _id: new ObjectId(membershipId),
        status: "Pending",
      },
      {
        $set: {
          status: "Declined",
          declineReason: reason,
          updatedAt: new Date(),
          declinedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error("Membership not found or already processed");
    }

    // Send notification to user about decline with the reason
    try {
      const notificationMessage = reason
        ? `Your ${membership.planType} membership application has been declined.\n\nReason: ${reason}\n\nYou can apply again with corrected information.`
        : `Your ${membership.planType} membership application has been declined.\n\nYou can apply again with corrected information.`;

      const notificationResult = await createNotification({
        userId: membership.userId,
        title: "❌ Membership Declined",
        message: notificationMessage,
        type: "error",
        relatedId: membershipId,
      });
      console.log("Membership decline notification:", notificationResult);
    } catch (notificationError) {
      console.error("Failed to send decline notification:", notificationError);
      // Don't throw error, just log it
    }

    return {
      success: true,
      message: "Membership declined successfully",
    };
  } catch (error) {
    console.error("Error declining membership:", error);
    return {
      success: false,
      message: error.message,
    };
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
  approveMembership,
  declineMembership,
  getMembershipApplication,
};
