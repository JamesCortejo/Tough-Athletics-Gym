// src/routes/adminroutes.js
const express = require("express");
const path = require("path");
const {
  adminLogin,
  verifyAdminToken,
} = require("../handlers/adminLoginHandler");

const router = express.Router();

// Serve admin login page
router.get("/admin/login", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "admin_pages", "adminLogin.html")
  );
});

// Serve admin overview page - Check token via query parameter or session
router.get("/admin/overview", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "admin_pages", "adminOverview.html")
  );
});

// Admin login endpoint
router.post("/admin/login", async (req, res) => {
  try {
    const result = await adminLogin(req.body);

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during admin login",
    });
  }
});

// Admin logout endpoint
router.post("/admin/logout", verifyAdminToken, (req, res) => {
  res.json({
    success: true,
    message: "Admin logged out successfully",
  });
});

// Protected admin data endpoint (example)
router.get("/admin/data", verifyAdminToken, async (req, res) => {
  try {
    // You can add admin-specific data fetching here
    res.json({
      success: true,
      message: "Admin data accessed successfully",
      admin: req.admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching admin data",
    });
  }
});

// Check admin authentication status
router.get("/admin/check-auth", verifyAdminToken, (req, res) => {
  res.json({
    success: true,
    message: "Admin is authenticated",
    admin: req.admin,
  });
});

module.exports = router;
