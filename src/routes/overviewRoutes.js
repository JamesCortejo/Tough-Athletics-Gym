// src/routes/overviewRoutes.js

const express = require("express");
const router = express.Router();
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { verifyToken } = require("../handlers/loginHandler");

// Get overview statistics
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const membershipsCollection = db.collection("memberships");
    const usercheckinCollection = db.collection("usercheckin");

    // Get all non-admin users
    const allUsers = await usersCollection.find({ isAdmin: false }).toArray();
    const totalUsers = allUsers.length;

    // Get active memberships
    const activeMemberships = await membershipsCollection
      .find({ status: "Active" })
      .toArray();
    const activeMembers = activeMemberships.length;

    // Get pending applications
    const pendingApplications = await membershipsCollection
      .find({ status: "Pending" })
      .toArray();

    // Get today's checkins
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCheckins = await usercheckinCollection.countDocuments({
      checkinTime: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // Calculate monthly revenue
    const monthlyRevenue = activeMemberships.reduce((total, membership) => {
      let monthlyAmount = 0;
      if (membership.planType === "Basic") monthlyAmount = membership.amount; // 1 month
      if (membership.planType === "Premium")
        monthlyAmount = membership.amount / 3; // 3 months
      if (membership.planType === "VIP") monthlyAmount = membership.amount / 6; // 6 months
      return total + monthlyAmount;
    }, 0);

    // Calculate average daily attendance (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentCheckins = await usercheckinCollection
      .find({
        checkinTime: { $gte: oneWeekAgo },
      })
      .toArray();

    // Group checkins by day
    const checkinsByDay = {};
    recentCheckins.forEach((checkin) => {
      const date = new Date(checkin.checkinTime).toDateString();
      checkinsByDay[date] = (checkinsByDay[date] || 0) + 1;
    });

    const dailyCheckins = Object.values(checkinsByDay);
    const avgAttendance =
      dailyCheckins.length > 0
        ? (
            dailyCheckins.reduce((a, b) => a + b, 0) / dailyCheckins.length
          ).toFixed(1)
        : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeMembers,
        pendingApplications: pendingApplications.length,
        todayCheckins,
        monthlyRevenue: Math.round(monthlyRevenue),
        avgAttendance: parseFloat(avgAttendance),
      },
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overview statistics",
    });
  }
});

// Get chart data for overview
router.get("/charts", verifyToken, async (req, res) => {
  try {
    const { timeRange = "30" } = req.query;
    const days = parseInt(timeRange);

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const membershipsCollection = db.collection("memberships");
    const usercheckinCollection = db.collection("usercheckin");

    // Get all data needed for charts
    const users = await usersCollection.find({ isAdmin: false }).toArray();
    const memberships = await membershipsCollection.find({}).toArray();
    const checkins = await usercheckinCollection.find({}).toArray();

    // Process chart data
    const chartData = await processChartData(
      users,
      memberships,
      checkins,
      days
    );

    res.json({
      success: true,
      chartData,
    });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chart data",
    });
  }
});

// Helper function to process chart data
async function processChartData(users, memberships, checkins, timeRange) {
  // Membership Growth Chart Data
  const membershipGrowth = calculateMembershipGrowth(memberships, timeRange);

  // Plan Distribution Chart Data
  const activeMemberships = memberships.filter((m) => m.status === "Active");
  const planDistribution = calculatePlanDistribution(activeMemberships);

  // Check-in Activity Chart Data
  const checkinActivity = calculateCheckinActivity(checkins, timeRange);

  // Gender Distribution Chart Data
  const genderDistribution = calculateGenderDistribution(users);

  // Age Distribution Chart Data
  const ageDistribution = calculateAgeDistribution(users);

  // Revenue Breakdown Chart Data
  const revenueBreakdown = calculateRevenueBreakdown(activeMemberships);

  // Application Status Chart Data
  const applicationStatus = calculateApplicationStatus(memberships);

  return {
    membershipGrowth,
    planDistribution,
    checkinActivity,
    genderDistribution,
    ageDistribution,
    revenueBreakdown,
    applicationStatus,
  };
}

function calculateMembershipGrowth(memberships, days) {
  const labels = [];
  const newMembersData = [];
  const totalMembersData = [];

  // Generate labels based on time range
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }

  // Calculate new members per day (approved memberships)
  labels.forEach((label, index) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - (days - 1 - index));
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const newMembers = memberships.filter((m) => {
      if (!m.approvedAt) return false;
      const approvedDate = new Date(m.approvedAt);
      return approvedDate >= targetDate && approvedDate < nextDay;
    }).length;

    newMembersData.push(newMembers);
  });

  // Calculate cumulative total members
  let runningTotal = 0;
  const cumulativeData = newMembersData.map((newMembers) => {
    runningTotal += newMembers;
    return runningTotal;
  });

  return {
    labels,
    newMembers: newMembersData,
    totalMembers: cumulativeData,
  };
}

function calculatePlanDistribution(activeMemberships) {
  const planCounts = {
    Basic: 0,
    Premium: 0,
    VIP: 0,
  };

  activeMemberships.forEach((membership) => {
    if (planCounts.hasOwnProperty(membership.planType)) {
      planCounts[membership.planType]++;
    }
  });

  return {
    labels: Object.keys(planCounts),
    data: Object.values(planCounts),
    colors: ["#4e73df", "#1cc88a", "#36b9cc"],
  };
}

function calculateCheckinActivity(checkins, days) {
  const labels = [];
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString("en-US", { weekday: "short" }));

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayCheckins = checkins.filter((checkin) => {
      const checkinDate = new Date(checkin.checkinTime);
      return checkinDate >= dayStart && checkinDate <= dayEnd;
    }).length;

    data.push(dayCheckins);
  }

  return {
    labels,
    data,
  };
}

function calculateGenderDistribution(users) {
  const genderCounts = {
    Male: 0,
    Female: 0,
    Other: 0,
  };

  users.forEach((user) => {
    const gender = user.gender;

    if (!gender) {
      genderCounts["Other"]++;
      return;
    }

    // Handle different case formats
    const normalizedGender =
      gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();

    if (normalizedGender === "Male") {
      genderCounts["Male"]++;
    } else if (normalizedGender === "Female") {
      genderCounts["Female"]++;
    } else {
      genderCounts["Other"]++;
    }
  });

  // Filter out genders with 0 count for cleaner display
  const filteredLabels = [];
  const filteredData = [];
  const filteredColors = [];

  Object.keys(genderCounts).forEach((gender, index) => {
    if (genderCounts[gender] > 0) {
      filteredLabels.push(gender);
      filteredData.push(genderCounts[gender]);
      filteredColors.push(["#4e73df", "#e74a3b", "#f6c23e"][index]);
    }
  });

  return {
    labels: filteredLabels,
    data: filteredData,
    colors: filteredColors,
  };
}

function calculateAgeDistribution(users) {
  const ageGroups = {
    "Under 18": 0,
    "18-25": 0,
    "26-35": 0,
    "36-50": 0,
    "50+": 0,
  };

  users.forEach((user) => {
    const age = user.age || 0;
    if (age < 18) ageGroups["Under 18"]++;
    else if (age <= 25) ageGroups["18-25"]++;
    else if (age <= 35) ageGroups["26-35"]++;
    else if (age <= 50) ageGroups["36-50"]++;
    else ageGroups["50+"]++;
  });

  return {
    labels: Object.keys(ageGroups),
    data: Object.values(ageGroups),
    colors: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e", "#e74a3b"],
  };
}

function calculateRevenueBreakdown(activeMemberships) {
  const revenueByPlan = {
    Basic: 0,
    Premium: 0,
    VIP: 0,
  };

  activeMemberships.forEach((membership) => {
    if (revenueByPlan.hasOwnProperty(membership.planType)) {
      revenueByPlan[membership.planType] += membership.amount;
    }
  });

  return {
    labels: Object.keys(revenueByPlan),
    data: Object.values(revenueByPlan),
    colors: ["#4e73df", "#1cc88a", "#36b9cc"],
  };
}

function calculateApplicationStatus(memberships) {
  const statusCounts = {
    Active: 0,
    Pending: 0,
    Declined: 0,
  };

  memberships.forEach((membership) => {
    if (statusCounts.hasOwnProperty(membership.status)) {
      statusCounts[membership.status]++;
    }
  });

  console.log("📊 Application status counts:", statusCounts);

  return {
    labels: Object.keys(statusCounts),
    data: Object.values(statusCounts),
    colors: ["#1cc88a", "#f6c23e", "#e74a3b"],
  };
}
module.exports = router;
