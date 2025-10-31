const express = require("express");
const router = express.Router();
const { verifyToken } = require("../handlers/loginHandler");
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} = require("../handlers/notificationHandler");

// Get user notifications
router.get("/", verifyToken, async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await getUserNotifications(
      req.user.userId,
      parseInt(limit) || 20
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Mark notification as read
router.put("/:notificationId/read", verifyToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const result = await markAsRead(notificationId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Mark all notifications as read
router.put("/read-all", verifyToken, async (req, res) => {
  try {
    const result = await markAllAsRead(req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Delete a notification
router.delete("/:notificationId", verifyToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const result = await deleteNotification(notificationId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Clear all notifications
router.delete("/", verifyToken, async (req, res) => {
  try {
    const result = await clearAllNotifications(req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Clear all notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
