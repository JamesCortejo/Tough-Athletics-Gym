// checkinHandler.js
const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { createNotification } = require("./notificationHandler");

async function checkinMember(qrCodeInput) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");
    const usercheckinCollection = db.collection("usercheckin");

    console.log("🔍 Received QR code input:", qrCodeInput);

    let qrCodeId;
    try {
      const qrData = JSON.parse(qrCodeInput);
      qrCodeId = qrData.qrCodeId;
      console.log("📊 Parsed JSON, extracted qrCodeId:", qrCodeId);
    } catch (e) {
      qrCodeId = qrCodeInput;
      console.log("📝 Using raw input as qrCodeId:", qrCodeId);
    }

    if (!qrCodeId) {
      throw new Error("No QR code ID found in input");
    }

    console.log("🔍 Looking for memberships with QR code ID:", qrCodeId);

    const memberships = await membershipsCollection
      .find({
        qrCodeId: qrCodeId,
      })
      .sort({ appliedAt: -1 })
      .toArray();

    console.log("📋 Found memberships:", memberships.length);
    memberships.forEach((membership, index) => {
      console.log(
        `  ${index + 1}. Status: ${membership.status}, Applied: ${
          membership.appliedAt
        }, Active: ${membership.status === "Active"}`
      );
    });

    if (memberships.length === 0) {
      throw new Error("No membership found for this QR code");
    }

    // Find the most recent ACTIVE membership
    const activeMembership = memberships.find(
      (membership) => membership.status === "Active"
    );

    if (!activeMembership) {
      // Check if there are any memberships at all and show the most recent status
      const mostRecentMembership = memberships[0];
      throw new Error(
        `No active membership found. Most recent membership status: "${
          mostRecentMembership.status
        }" (applied on ${new Date(
          mostRecentMembership.appliedAt
        ).toLocaleDateString()})`
      );
    }

    console.log("✅ Using active membership:", {
      _id: activeMembership._id,
      firstName: activeMembership.firstName,
      lastName: activeMembership.lastName,
      status: activeMembership.status,
      appliedAt: activeMembership.appliedAt,
      endDate: activeMembership.endDate,
    });

    // Check if the active membership has expired
    const currentDate = new Date();
    const endDate = new Date(activeMembership.endDate);

    if (currentDate > endDate) {
      throw new Error(`Membership expired on ${endDate.toLocaleDateString()}`);
    }

    // Check if member already checked in today - using usercheckin collection
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingCheckin = await usercheckinCollection.findOne({
      qrCodeId: qrCodeId,
      checkinTime: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    });

    if (existingCheckin) {
      throw new Error("Member already checked in today");
    }

    return {
      success: true,
      message: "Member checked in successfully",
      membership: activeMembership,
    };
  } catch (error) {
    console.error("❌ Check-in error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

async function recordCheckin(checkinData, adminInfo = null) {
  try {
    const db = await connectToDatabase();
    const usercheckinCollection = db.collection("usercheckin");

    console.log("🔍 Starting recordCheckin with data:", {
      checkinData: {
        qrCodeId: checkinData.qrCodeId,
        membershipId: checkinData.membershipId,
        firstName: checkinData.firstName,
        lastName: checkinData.lastName,
        manualEntry: checkinData.manualEntry,
      },
      adminInfo: adminInfo,
    });

    const checkinDocument = {
      qrCodeId: checkinData.qrCodeId,
      membershipId: new ObjectId(checkinData.membershipId),
      userId: new ObjectId(checkinData.userId),
      checkinTime: new Date(checkinData.checkinTime),

      // Additional membership data (excluding profilePicture)
      planType: checkinData.planType,
      firstName: checkinData.firstName,
      lastName: checkinData.lastName,
      email: checkinData.email,
      phone: checkinData.phone,
      startDate: new Date(checkinData.startDate),
      endDate: new Date(checkinData.endDate),
      appliedAt: new Date(checkinData.appliedAt),

      // Metadata
      createdAt: new Date(),
      status: "checked_in",

      // Add admin info for debugging
      checkedInBy: adminInfo
        ? {
            adminId: adminInfo.userId,
            adminName: adminInfo.username,
          }
        : "system",
    };

    console.log("📝 Recording check-in in usercheckin collection:", {
      checkinDocument: {
        qrCodeId: checkinDocument.qrCodeId,
        membershipId: checkinDocument.membershipId,
        memberName: `${checkinDocument.firstName} ${checkinDocument.lastName}`,
        checkedInBy: checkinDocument.checkedInBy,
      },
    });

    const result = await usercheckinCollection.insertOne(checkinDocument);
    console.log(
      "✅ Check-in recorded successfully in usercheckin collection, insertedId:",
      result.insertedId
    );

    // Log admin action if performed by admin
    if (adminInfo) {
      console.log("🔍 Admin info provided, logging admin action...");
      const logResult = await logAdminCheckinAction(db, checkinData, adminInfo);

      if (logResult.success) {
        console.log("✅ Admin action logged successfully:", {
          logId: logResult.insertedId,
          action: "member_checkin",
          member: `${checkinData.firstName} ${checkinData.lastName}`,
          admin: adminInfo.username,
        });
      } else {
        console.error("❌ Failed to log admin action:", logResult.message);
        // Don't throw error, just log it
      }
    } else {
      console.log("⚠️ No admin info provided, skipping admin action logging");
    }

    // Send notification to the user about the check-in
    await sendCheckinNotification(checkinData);

    return {
      success: true,
      message: "Check-in recorded successfully in usercheckin collection",
      checkinId: result.insertedId,
    };
  } catch (error) {
    console.error("❌ Record check-in error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Function to log admin check-in actions
async function logAdminCheckinAction(db, checkinData, adminInfo) {
  try {
    console.log("📝 Creating admin action log entry...");

    const adminAction = {
      action: "member_checkin",
      membershipId: new ObjectId(checkinData.membershipId),
      memberName: `${checkinData.firstName} ${checkinData.lastName}`,
      qrCodeId: checkinData.qrCodeId,
      checkinTime: new Date(checkinData.checkinTime),
      adminId: new ObjectId(adminInfo.userId),
      adminName: adminInfo.username || "Unknown Admin",
      timestamp: new Date(),
      details: {
        planType: checkinData.planType,
        manualEntry: checkinData.manualEntry || false,
        // Removed checkinMethod field as requested
      },
    };

    console.log("🔍 Admin action document to insert:", {
      action: adminAction.action,
      member: adminAction.memberName,
      admin: adminAction.adminName,
      timestamp: adminAction.timestamp,
      manualEntry: adminAction.details.manualEntry,
    });

    // First, check if admin_actions collection exists
    const collections = await db
      .listCollections({ name: "admin_actions" })
      .toArray();
    if (collections.length === 0) {
      console.log("⚠️ admin_actions collection doesn't exist, creating it...");
      // Collection will be created automatically on first insert
    }

    const result = await db.collection("admin_actions").insertOne(adminAction);

    console.log(
      "✅ Admin action inserted successfully, insertedId:",
      result.insertedId
    );

    // Verify the document was inserted
    const insertedDoc = await db
      .collection("admin_actions")
      .findOne({ _id: result.insertedId });
    if (insertedDoc) {
      console.log("✅ Admin action document verified in database");
    } else {
      console.error("❌ Failed to verify admin action document insertion");
    }

    return {
      success: true,
      insertedId: result.insertedId,
    };
  } catch (error) {
    console.error("❌ Error logging admin check-in action:", error);

    // Provide more specific error information
    let errorMessage = error.message;
    if (error.name === "MongoError" || error.name === "MongoServerError") {
      if (error.code === 13) {
        errorMessage = "Permission denied to write to admin_actions collection";
      } else if (error.code === 26) {
        errorMessage = "admin_actions collection namespace not found";
      }
    }

    // Return error but don't throw - we don't want to fail the check-in
    return {
      success: false,
      message: errorMessage,
    };
  }
}

async function sendCheckinNotification(checkinData) {
  try {
    const notificationResult = await createNotification({
      userId: checkinData.userId,
      title: "Check-in Successful",
      message: `Hello ${
        checkinData.firstName
      }! You have been successfully checked in at ${new Date().toLocaleTimeString()}.`,
      type: "success",
      relatedId: checkinData.membershipId,
    });

    if (notificationResult.success) {
      console.log("✅ Check-in notification sent to user:", checkinData.userId);
    } else {
      console.error(
        "❌ Failed to send check-in notification:",
        notificationResult.message
      );
    }
  } catch (error) {
    console.error("❌ Error sending check-in notification:", error);
    // Don't throw error here as we don't want to fail the check-in if notification fails
  }
}

// Helper function to check admin_actions collection status
async function checkAdminActionsCollection() {
  try {
    const db = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    const adminActionsExists = collections.some(
      (col) => col.name === "admin_actions"
    );

    if (adminActionsExists) {
      const count = await db.collection("admin_actions").countDocuments();
      const recentActions = await db
        .collection("admin_actions")
        .find({})
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray();

      return {
        exists: true,
        count: count,
        recentActions: recentActions,
      };
    } else {
      return {
        exists: false,
        collections: collections.map((col) => col.name),
      };
    }
  } catch (error) {
    console.error("Error checking admin_actions collection:", error);
    return {
      exists: false,
      error: error.message,
    };
  }
}

module.exports = {
  checkinMember,
  recordCheckin,
  checkAdminActionsCollection,
};
