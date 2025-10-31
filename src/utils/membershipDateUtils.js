const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");

/**
 * Utility functions for membership date calculations and status management
 */

// Calculate remaining days between two dates
function calculateRemainingDays(endDate) {
  if (!endDate) return 0;

  const today = new Date();
  const expiry = new Date(endDate);

  // Reset both dates to midnight for consistent day calculation
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const expiryMidnight = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );

  const timeDiff = expiryMidnight.getTime() - todayMidnight.getTime();
  const remainingDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

  return remainingDays > 0 ? remainingDays : 0;
}

// Calculate membership end date based on plan type and start date (exact calendar months)
function calculateEndDate(startDate, planType) {
  const start = new Date(startDate);
  const endDate = new Date(start);

  let monthsToAdd = 0;

  switch (planType) {
    case "Basic":
      monthsToAdd = 1;
      break;
    case "Premium":
      monthsToAdd = 3;
      break;
    case "VIP":
      monthsToAdd = 6;
      break;
    default:
      monthsToAdd = 1;
  }

  // Get the current day of the month
  const currentDay = start.getDate();

  // Add months
  endDate.setMonth(endDate.getMonth() + monthsToAdd);

  // Check if we've crossed a month boundary where the day doesn't exist
  // (e.g., Jan 31 + 1 month would try to create Feb 31, which doesn't exist)
  if (endDate.getDate() !== currentDay) {
    // If the day changed, we crossed a month boundary, so set to last day of previous month
    endDate.setDate(0); // 0 means last day of previous month
  }

  endDate.setHours(23, 59, 59, 999);
  return endDate;
}

// Check if a membership is currently active
function isMembershipActive(membership) {
  if (!membership || membership.status !== "Active") {
    return false;
  }

  const today = new Date();
  const endDate = new Date(membership.endDate);

  return today <= endDate;
}

// Check if a membership has expired
function isMembershipExpired(membership) {
  if (!membership || membership.status !== "Active") {
    return false;
  }

  const today = new Date();
  const endDate = new Date(membership.endDate);

  return today > endDate;
}

// Get membership status with detailed information
function getMembershipStatus(membership) {
  if (!membership) {
    return {
      status: "No Membership",
      isActive: false,
      isExpired: false,
      isPending: false,
      remainingDays: 0,
      message: "No membership found",
    };
  }

  const today = new Date();
  const startDate = new Date(membership.startDate);
  const endDate = new Date(membership.endDate);

  const remainingDays = calculateRemainingDays(endDate);
  const isActive = membership.status === "Active" && today <= endDate;
  const isExpired = membership.status === "Active" && today > endDate;
  const isPending = membership.status === "Pending";

  let status, message;

  if (isPending) {
    status = "Pending";
    message = "Membership pending admin approval";
  } else if (isActive) {
    status = "Active";
    message = `Membership active with ${remainingDays} days remaining`;
  } else if (isExpired) {
    status = "Expired";
    message = "Membership has expired";
  } else {
    status = membership.status;
    message = `Membership status: ${membership.status}`;
  }

  return {
    status: status,
    isActive: isActive,
    isExpired: isExpired,
    isPending: isPending,
    remainingDays: remainingDays,
    startDate: startDate,
    endDate: endDate,
    message: message,
    planType: membership.planType,
  };
}

// Automatically update expired memberships in the database
async function updateExpiredMemberships() {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const today = new Date();

    // Find all active memberships that have expired
    const expiredMemberships = await membershipsCollection.updateMany(
      {
        status: "Active",
        endDate: { $lt: today },
      },
      {
        $set: {
          status: "Expired",
          updatedAt: new Date(),
        },
      }
    );

    console.log(
      `✅ Updated ${expiredMemberships.modifiedCount} expired memberships`
    );

    return {
      success: true,
      updatedCount: expiredMemberships.modifiedCount,
      message: `Updated ${expiredMemberships.modifiedCount} expired memberships`,
    };
  } catch (error) {
    console.error("Error updating expired memberships:", error);
    return {
      success: false,
      updatedCount: 0,
      message: error.message,
    };
  }
}

// Get membership summary for a user
async function getUserMembershipSummary(userId) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const membership = await membershipsCollection.findOne({
      userId: new ObjectId(userId),
      status: { $in: ["Active", "Pending"] },
    });

    const statusInfo = getMembershipStatus(membership);

    return {
      success: true,
      membership: membership,
      status: statusInfo,
    };
  } catch (error) {
    console.error("Error getting user membership summary:", error);
    return {
      success: false,
      membership: null,
      status: getMembershipStatus(null),
    };
  }
}

// Get all memberships with calculated status (for admin dashboard)
async function getAllMembershipsWithStatus() {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");

    const memberships = await membershipsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Enhance each membership with calculated status
    const membershipsWithStatus = memberships.map((membership) => {
      const statusInfo = getMembershipStatus(membership);
      return {
        ...membership,
        calculatedStatus: statusInfo.status,
        remainingDays: statusInfo.remainingDays,
        isActive: statusInfo.isActive,
        isExpired: statusInfo.isExpired,
      };
    });

    return {
      success: true,
      memberships: membershipsWithStatus,
      total: membershipsWithStatus.length,
      active: membershipsWithStatus.filter((m) => m.isActive).length,
      expired: membershipsWithStatus.filter((m) => m.isExpired).length,
      pending: membershipsWithStatus.filter((m) => m.status === "Pending")
        .length,
    };
  } catch (error) {
    console.error("Error getting all memberships with status:", error);
    return {
      success: false,
      memberships: [],
      total: 0,
      active: 0,
      expired: 0,
      pending: 0,
    };
  }
}

module.exports = {
  calculateRemainingDays,
  calculateEndDate,
  isMembershipActive,
  isMembershipExpired,
  getMembershipStatus,
  updateExpiredMemberships,
  getUserMembershipSummary,
  getAllMembershipsWithStatus,
};
