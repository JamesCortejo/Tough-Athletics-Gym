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
    const nonmembersCollection = db.collection("nonmembers");

    // Get all non-admin users
    const allUsers = await usersCollection.find({ isAdmin: false }).toArray();
    const totalUsers = allUsers.length;

    // Get active memberships (status = Active AND endDate is in future)
    const now = new Date();
    const activeMemberships = await membershipsCollection
      .find({
        status: "Active",
        endDate: { $gt: now },
      })
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

    // Calculate revenue from active memberships - USING ACTUAL AMOUNTS FROM DATABASE
    let basicRevenue = 0;
    let premiumRevenue = 0;
    let vipRevenue = 0;

    activeMemberships.forEach((membership) => {
      const amount = Number(membership.amount) || 0;
      if (membership.planType === "Basic") {
        basicRevenue += amount;
      } else if (membership.planType === "Premium") {
        premiumRevenue += amount;
      } else if (membership.planType === "VIP") {
        vipRevenue += amount;
      }
    });

    const membershipRevenue = basicRevenue + premiumRevenue + vipRevenue;

    // Calculate monthly revenue from non-members (walk-ins)
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const currentMonthEnd = new Date(currentMonthStart);
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);

    // Get non-members from the nonmembers collection for current month
    const nonMemberCheckins = await nonmembersCollection
      .find({
        checkInTime: {
          $gte: currentMonthStart,
          $lt: currentMonthEnd,
        },
      })
      .toArray();

    const nonMemberRevenue = nonMemberCheckins.reduce((total, checkin) => {
      return total + (checkin.amount || 75);
    }, 0);

    // Total revenue = membership revenue + non-member revenue
    const totalMonthlyRevenue = membershipRevenue + nonMemberRevenue;

    // Calculate average daily attendance (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get member checkins
    const recentMemberCheckins = await usercheckinCollection
      .find({
        checkinTime: { $gte: oneWeekAgo },
      })
      .toArray();

    // Get non-member checkins
    const recentNonMemberCheckins = await nonmembersCollection
      .find({
        checkInTime: { $gte: oneWeekAgo },
      })
      .toArray();

    // Combine both member and non-member checkins
    const allRecentCheckins = [
      ...recentMemberCheckins,
      ...recentNonMemberCheckins,
    ];

    // Group checkins by day
    const checkinsByDay = {};
    allRecentCheckins.forEach((checkin) => {
      const date = new Date(
        checkin.checkinTime || checkin.checkInTime
      ).toDateString();
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
        monthlyRevenue: Math.round(totalMonthlyRevenue),
        avgAttendance: parseFloat(avgAttendance),
        // Include breakdown for debugging
        revenueBreakdown: {
          membershipRevenue: Math.round(membershipRevenue),
          nonMemberRevenue: Math.round(nonMemberRevenue),
          membershipDetails: {
            basic: Math.round(basicRevenue),
            premium: Math.round(premiumRevenue),
            vip: Math.round(vipRevenue),
          },
        },
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
    const nonmembersCollection = db.collection("nonmembers");

    // Get all data needed for charts
    const users = await usersCollection.find({ isAdmin: false }).toArray();
    const memberships = await membershipsCollection.find({}).toArray();
    const checkins = await usercheckinCollection.find({}).toArray();
    const nonmembers = await nonmembersCollection.find({}).toArray();

    // Process chart data
    const chartData = await processChartData(
      users,
      memberships,
      checkins,
      nonmembers,
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
async function processChartData(
  users,
  memberships,
  checkins,
  nonmembers,
  timeRange
) {
  // Filter active memberships (status = Active AND endDate in future)
  const now = new Date();
  const activeMemberships = memberships.filter(
    (m) => m.status === "Active" && new Date(m.endDate) > now
  );

  // Membership Growth Chart Data
  const membershipGrowth = calculateMembershipGrowth(memberships, timeRange);

  // Plan Distribution Chart Data
  const planDistribution = calculatePlanDistribution(activeMemberships);

  // Check-in Activity Chart Data
  const checkinActivity = calculateCheckinActivity(
    checkins,
    nonmembers,
    timeRange
  );

  // Gender Distribution Chart Data
  const genderDistribution = calculateGenderDistribution(users);

  // Age Distribution Chart Data
  const ageDistribution = calculateAgeDistribution(users);

  // Revenue Breakdown Chart Data - USING ACTUAL DATABASE AMOUNTS
  const revenueBreakdown = calculateRevenueBreakdown(
    activeMemberships,
    nonmembers
  );

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

function calculateCheckinActivity(checkins, nonmembers, days) {
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

    // Count member checkins
    const memberCheckins = checkins.filter((checkin) => {
      const checkinDate = new Date(checkin.checkinTime);
      return checkinDate >= dayStart && checkinDate <= dayEnd;
    }).length;

    // Count non-member checkins
    const nonMemberCheckins = nonmembers.filter((nonmember) => {
      const checkinDate = new Date(nonmember.checkInTime);
      return checkinDate >= dayStart && checkinDate <= dayEnd;
    }).length;

    // Total checkins = member + non-member
    const dayCheckins = memberCheckins + nonMemberCheckins;
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

function calculateRevenueBreakdown(activeMemberships, nonmembers) {
  let basicRevenue = 0;
  let premiumRevenue = 0;
  let vipRevenue = 0;

  // Calculate revenue from active memberships using ACTUAL AMOUNTS from database
  activeMemberships.forEach((membership) => {
    const amount = membership.amount || 0;

    if (membership.planType === "Basic") {
      basicRevenue += amount;
    } else if (membership.planType === "Premium") {
      premiumRevenue += amount;
    } else if (membership.planType === "VIP") {
      vipRevenue += amount;
    }
  });

  // Calculate non-member (walk-in) revenue from nonmembers collection for current month
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const currentMonthEnd = new Date(currentMonthStart);
  currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);

  const currentMonthNonMembers = nonmembers.filter((nonmember) => {
    const checkinDate = new Date(nonmember.checkInTime);
    return checkinDate >= currentMonthStart && checkinDate < currentMonthEnd;
  });

  const walkInRevenue = currentMonthNonMembers.reduce((total, nonmember) => {
    return total + (nonmember.amount || 75);
  }, 0);

  const revenueByPlan = {
    Basic: basicRevenue,
    Premium: premiumRevenue,
    VIP: vipRevenue,
    "Walk-in": walkInRevenue,
  };

  return {
    labels: Object.keys(revenueByPlan),
    data: Object.values(revenueByPlan),
    colors: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e"],
  };
}

function calculateApplicationStatus(memberships) {
  const statusCounts = {
    Active: 0,
    Pending: 0,
    Declined: 0,
    Expired: 0,
  };

  memberships.forEach((membership) => {
    if (statusCounts.hasOwnProperty(membership.status)) {
      statusCounts[membership.status]++;
    }
  });

  return {
    labels: Object.keys(statusCounts),
    data: Object.values(statusCounts),
    colors: ["#1cc88a", "#f6c23e", "#e74a3b", "#858796"],
  };
}

module.exports = router;
