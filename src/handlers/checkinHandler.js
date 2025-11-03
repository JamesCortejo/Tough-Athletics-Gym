const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");
const { createNotification } = require("./notificationHandler");

async function checkinMember(qrCodeInput) {
  try {
    const db = await connectToDatabase();
    const membershipsCollection = db.collection("memberships");
    const usercheckinCollection = db.collection("usercheckin");

    console.log("🔍 Received QR code input:", qrCodeInput);

    // Parse the QR code input - it could be a JSON string or just the ID
    let qrCodeId;
    try {
      // Try to parse as JSON
      const qrData = JSON.parse(qrCodeInput);
      qrCodeId = qrData.qrCodeId;
      console.log("📊 Parsed JSON, extracted qrCodeId:", qrCodeId);
    } catch (e) {
      // If it's not JSON, use the raw input
      qrCodeId = qrCodeInput;
      console.log("📝 Using raw input as qrCodeId:", qrCodeId);
    }

    if (!qrCodeId) {
      throw new Error("No QR code ID found in input");
    }

    console.log("🔍 Looking for memberships with QR code ID:", qrCodeId);

    // Find ALL memberships with this QR code, sorted by appliedAt date (newest first)
    const memberships = await membershipsCollection
      .find({
        qrCodeId: qrCodeId,
      })
      .sort({ appliedAt: -1 }) // -1 for descending (newest first)
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

async function recordCheckin(checkinData) {
  try {
    const db = await connectToDatabase();
    const usercheckinCollection = db.collection("usercheckin");

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
    };

    console.log(
      "📝 Recording check-in in usercheckin collection (without profile picture):",
      checkinDocument
    );

    const result = await usercheckinCollection.insertOne(checkinDocument);

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

module.exports = {
  checkinMember,
  recordCheckin,
};
