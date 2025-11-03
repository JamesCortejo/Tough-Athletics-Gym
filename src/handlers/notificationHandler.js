const { connectToDatabase } = require("../config/db");
const { ObjectId } = require("mongodb");

// Create a notification
async function createNotification(notificationData) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const notification = {
      userId: new ObjectId(notificationData.userId),
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || "info", // info, success, warning, error
      isRead: false,
      isCleared: false, // New field for soft delete
      relatedId: notificationData.relatedId, // Optional: membership ID, etc.
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await notificationsCollection.insertOne(notification);

    return {
      success: true,
      notificationId: result.insertedId,
      message: "Notification created successfully",
    };
  } catch (error) {
    console.error("Error creating notification:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Get notifications for a user (only non-cleared notifications)
async function getUserNotifications(userId, limit = 20) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const notifications = await notificationsCollection
      .find({
        userId: new ObjectId(userId),
        isCleared: { $ne: true }, // Only get notifications that are not cleared
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Count unread notifications (only non-cleared)
    const unreadCount = await notificationsCollection.countDocuments({
      userId: new ObjectId(userId),
      isRead: false,
      isCleared: { $ne: true },
    });

    return {
      success: true,
      notifications: notifications,
      unreadCount: unreadCount,
      total: notifications.length,
    };
  } catch (error) {
    console.error("Error getting user notifications:", error);
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      total: 0,
    };
  }
}

// Mark notification as read
async function markAsRead(notificationId) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { isRead: true, updatedAt: new Date() } }
    );

    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Mark all notifications as read for a user
async function markAllAsRead(userId) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const result = await notificationsCollection.updateMany(
      {
        userId: new ObjectId(userId),
        isRead: false,
        isCleared: { $ne: true }, // Only update non-cleared notifications
      },
      { $set: { isRead: true, updatedAt: new Date() } }
    );

    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Delete a notification (soft delete - mark as cleared)
async function deleteNotification(notificationId) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { isCleared: true, updatedAt: new Date() } }
    );

    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Clear all notifications for a user (soft delete - mark all as cleared)
async function clearAllNotifications(userId) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const result = await notificationsCollection.updateMany(
      {
        userId: new ObjectId(userId),
        isCleared: { $ne: true }, // Only update notifications that aren't already cleared
      },
      { $set: { isCleared: true, updatedAt: new Date() } }
    );

    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error clearing all notifications:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Get cleared notifications for a user (for admin purposes)
async function getClearedNotifications(userId, limit = 50) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const notifications = await notificationsCollection
      .find({
        userId: new ObjectId(userId),
        isCleared: true,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return {
      success: true,
      notifications: notifications,
      total: notifications.length,
    };
  } catch (error) {
    console.error("Error getting cleared notifications:", error);
    return {
      success: false,
      notifications: [],
      total: 0,
    };
  }
}

// Permanently delete cleared notifications older than specified days
async function permanentlyDeleteOldNotifications(daysOld = 30) {
  try {
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await notificationsCollection.deleteMany({
      isCleared: true,
      updatedAt: { $lt: cutoffDate },
    });

    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    console.error("Error permanently deleting old notifications:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getClearedNotifications,
  permanentlyDeleteOldNotifications,
};
