// utils/userActionLogger.js
const { connectToDatabase } = require("../config/db");

async function logUserAction(
  userId,
  actionType,
  authMethod,
  qrCodeId,
  additionalData = {}
) {
  try {
    console.log(
      `[UserActionLogger] Attempting to log ${actionType} for user ${userId}`
    );

    // Validate required fields with more details
    if (!userId || !actionType) {
      console.error(
        "[UserActionLogger] ERROR: userId and actionType are required",
        { userId, actionType, authMethod, qrCodeId }
      );
      return null;
    }

    const db = await connectToDatabase();
    console.log("[UserActionLogger] Database connected successfully");

    const userActionsCollection = db.collection("user_actions");
    console.log("[UserActionLogger] Using collection: user_actions");

    const actionRecord = {
      userId: userId,
      actionType: actionType,
      authMethod: authMethod || "unknown",
      qrCodeId: qrCodeId || null,
      timestamp: new Date(),
      ipAddress: additionalData.ipAddress || null,
      userAgent: additionalData.userAgent || null,
      ...additionalData,
    };

    console.log(
      "[UserActionLogger] Action record to insert:",
      JSON.stringify(actionRecord, null, 2)
    );

    const result = await userActionsCollection.insertOne(actionRecord);
    console.log(
      `[UserActionLogger] ✓ Successfully logged ${actionType} for user ${userId}, document ID: ${result.insertedId}`
    );

    return result;
  } catch (error) {
    console.error("[UserActionLogger] ERROR logging user action:", error);
    console.error("[UserActionLogger] Error details:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      actionType: actionType,
      userId: userId,
    });
    // Don't throw error to avoid breaking the main flow
    return null;
  }
}

async function getUserLoginHistory(userId, limit = 10) {
  try {
    const db = await connectToDatabase();
    const userActionsCollection = db.collection("user_actions");

    const loginHistory = await userActionsCollection
      .find({
        userId: userId,
        actionType: "login",
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return loginHistory;
  } catch (error) {
    console.error("Error fetching user login history:", error);
    return [];
  }
}

// Test function to check collection access
async function testUserActionsCollection() {
  try {
    const db = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((col) => col.name);
    console.log("[UserActionLogger] Available collections:", collectionNames);

    if (collectionNames.includes("user_actions")) {
      console.log("[UserActionLogger] ✓ user_actions collection exists");
      const userActionsCollection = db.collection("user_actions");
      const count = await userActionsCollection.countDocuments();
      console.log(
        `[UserActionLogger] user_actions collection has ${count} documents`
      );
    } else {
      console.error(
        "[UserActionLogger] ✗ user_actions collection does NOT exist"
      );
    }
  } catch (error) {
    console.error("[UserActionLogger] Error testing collection:", error);
  }
}

module.exports = {
  logUserAction,
  getUserLoginHistory,
  testUserActionsCollection,
};
