const express = require("express");
const path = require("path");
const router = express.Router();

// Register page
router.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user_pages/register.html"));
});

// Forgot email page (enter email to receive verification code)
router.get("/forgotEmail", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user_pages/forgotEmail.html"));
});

// Forgot email page (enter verification code)
router.get("/verifyEmail", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user_pages/verifyEmail.html"));
});

// Enter new password page
router.get("/enternewPass", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/user_pages/enternewPass.html"));
});

module.exports = router;
