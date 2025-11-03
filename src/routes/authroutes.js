const express = require("express");
const path = require("path");
const { registerUser } = require("../handlers/registerHandler");
const { loginUser, verifyToken } = require("../handlers/loginHandler");
const { verifyRecaptcha } = require("../utils/recaptcha");
const {
  generateResetCode,
  checkEmailExists,
  storeResetCode,
  verifyResetCode,
  updatePassword,
  validatePassword,
} = require("../handlers/passwordResetHandler");
const { sendResetEmail } = require("../utils/emailService");

const router = express.Router();

// Serve static pages
router.get("/register", (req, res) => {
  console.log("Serving register page");
  res.sendFile(path.join(__dirname, "../public/user_pages/register.html"));
});

router.get("/userhomepage", (req, res) => {
  console.log("Serving user homepage");
  const filePath = path.join(
    __dirname,
    "..",
    "public",
    "user_pages",
    "userhomepage.html"
  );
  res.sendFile(filePath);
});

// Add routes for other user pages
router.get("/userprofile", (req, res) => {
  const filePath = path.join(
    __dirname,
    "..",
    "public",
    "user_pages",
    "userprofile.html"
  );
  res.sendFile(filePath);
});

router.get("/usersettings", (req, res) => {
  const filePath = path.join(
    __dirname,
    "..",
    "public",
    "user_pages",
    "usersettings.html"
  );
  res.sendFile(filePath);
});

router.get("/usermembership", (req, res) => {
  const filePath = path.join(
    __dirname,
    "..",
    "public",
    "user_pages",
    "usermembership.html"
  );
  res.sendFile(filePath);
});

router.get("/gymhistory", (req, res) => {
  const filePath = path.join(
    __dirname,
    "..",
    "public",
    "user_pages",
    "gymhistory.html"
  );
  res.sendFile(filePath);
});

// Password Reset Pages
router.get("/forgotEmail", (req, res) => {
  console.log("Serving forgot email page");
  res.sendFile(path.join(__dirname, "../public/user_pages/forgotEmail.html"));
});

router.get("/verifyEmail", (req, res) => {
  console.log("Serving verify email page");
  res.sendFile(path.join(__dirname, "../public/user_pages/verifyEmail.html"));
});

router.get("/enternewPass", (req, res) => {
  console.log("Serving enter new password page");
  res.sendFile(path.join(__dirname, "../public/user_pages/enternewPass.html"));
});

router.get("/changepassword", (req, res) => {
  console.log("Serving change password page");
  res.sendFile(
    path.join(__dirname, "../public/user_pages/changepassword.html")
  );
});

// Handle registration form submission
router.post("/register", async (req, res) => {
  console.log("Received registration request:", req.body);

  try {
    const {
      firstName,
      lastName,
      username,
      email,
      mobile,
      gender,
      age,
      password,
      confirmPassword,
      recaptchaToken,
    } = req.body;

    // Basic validation
    if (
      !firstName ||
      !lastName ||
      !username ||
      !email ||
      !mobile ||
      !gender ||
      !age ||
      !password ||
      !confirmPassword
    ) {
      console.log("Missing required fields");
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    console.log("Calling registerUser function");
    const result = await registerUser({
      firstName,
      lastName,
      username,
      email,
      mobile,
      gender,
      age,
      password,
      confirmPassword,
      recaptchaToken,
    });

    console.log("Registration result:", result);

    if (result.success) {
      res.json({
        success: true,
        message: "Registration successful!",
        redirect: "/?registration=success",
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Registration route error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.post("/login", async (req, res) => {
  console.log("Received login request:", req.body);

  try {
    const { username, password, recaptchaToken } = req.body; // Add recaptchaToken

    // Basic validation
    if (!username || !password) {
      console.log("Missing username or password");
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // reCAPTCHA validation
    if (!recaptchaToken) {
      console.log("Missing reCAPTCHA token");
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA verification required",
      });
    }

    console.log("Calling loginUser function");
    const result = await loginUser({
      username,
      password,
      recaptchaToken, // Pass the token to login handler
    });

    console.log("Login result:", result);

    if (result.success) {
      res.json({
        success: true,
        message: "Login successful!",
        token: result.token,
        user: result.user,
        redirect: "/userhomepage",
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Login route error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Password Reset Routes

// Handle forgot password request
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, recaptchaToken } = req.body; // Add recaptchaToken

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Add reCAPTCHA validation
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: "Security verification required",
      });
    }

    // Verify reCAPTCHA
    const recaptchaResult = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaResult.success) {
      console.error("reCAPTCHA verification failed:", recaptchaResult.message);
      return res.status(400).json({
        success: false,
        message: `Security verification failed: ${recaptchaResult.message}`,
      });
    }

    console.log(
      "reCAPTCHA verified successfully, score:",
      recaptchaResult.score
    );
    console.log("Password reset requested for:", email);

    // Check if email exists
    const emailExists = await checkEmailExists(email);
    if (!emailExists) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our system",
      });
    }

    // Generate reset code
    const resetCode = generateResetCode();
    console.log(`Generated reset code for ${email}: ${resetCode}`);

    // Store reset code in database
    const storeResult = await storeResetCode(email, resetCode);
    if (!storeResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate reset code",
      });
    }

    // Send reset email
    const emailResult = await sendResetEmail(email, resetCode);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email",
      });
    }

    res.json({
      success: true,
      message: "Reset code sent to your email",
      redirect: `/verifyEmail?email=${encodeURIComponent(email)}`,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Handle reset code verification
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and code are required",
      });
    }

    console.log(`Verifying reset code for ${email}: ${code}`);

    // Verify reset code
    const verifyResult = await verifyResetCode(email, code);
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
      });
    }

    res.json({
      success: true,
      message: "Code verified successfully",
      redirect: `/enternewPass?email=${encodeURIComponent(email)}`,
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Handle password reset
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password requirements not met",
        errors: passwordValidation.errors,
      });
    }

    console.log(`Resetting password for: ${email}`);

    // Update password
    const updateResult = await updatePassword(email, newPassword);
    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        message: updateResult.message,
      });
    }

    res.json({
      success: true,
      message: "Password reset successfully",
      redirect: "/?reset=success",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Protected route example (for future use)
router.get("/api/user/profile", verifyToken, async (req, res) => {
  try {
    // req.user contains the decoded JWT payload
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
module.exports = router;
