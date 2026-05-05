const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verifyRecaptcha } = require("../utils/recaptcha");
const { logUserAction } = require("../utils/userActionLogger");
const encryptionService = require("../utils/encryptionService");

const JWT_SECRET = process.env.JWT_SECRET;

async function loginUser(loginData, requestInfo = {}) {
  console.log("Received login data:", loginData);

  try {
    const { username, password, recaptchaToken } = loginData;

    // Basic validation
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    // Verify reCAPTCHA
    if (!recaptchaToken) {
      throw new Error("reCAPTCHA verification required");
    }

    const recaptchaResult = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaResult.success) {
      throw new Error(
        `reCAPTCHA verification failed: ${recaptchaResult.message}`,
      );
    }

    console.log(
      "reCAPTCHA verified successfully, score:",
      recaptchaResult.score,
    );

    const db = await connectToDatabase();
    console.log("Database connected successfully for login");

    const usersCollection = db.collection("users");
    console.log("Using 'users' collection for login");

    // Find user by username
    const user = await usersCollection.findOne({
      username: username,
    });

    if (!user) {
      throw new Error("User not Found");
    }

    // Decrypt sensitive data for comparison and response
    const decryptedUser = encryptionService.decryptObject(user, [
      "email",
      "mobile",
      "googleId",
      "facebookId",
    ]);

    console.log("User found:", {
      username: decryptedUser.username,
      email: decryptedUser.email,
      qrCodeId: decryptedUser.qrCodeId,
      profilePicture: decryptedUser.profilePicture,
      authMethod: decryptedUser.authMethod,
      isArchived: decryptedUser.isArchived,
      isAdmin: decryptedUser.isAdmin,
    });

    // Check if account is archived
    if (decryptedUser.isArchived) {
      throw new Error(
        "This account has been archived. Please contact support.",
      );
    }

    // NEW: Check if user is an admin
    if (decryptedUser.isAdmin) {
      throw new Error("Invalid username or password");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid username or password");
    }

    console.log("Password verified successfully");

    // Ensure authMethod is properly included in JWT
    const userAuthMethod = decryptedUser.authMethod || "local";

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: decryptedUser._id.toString(),
        username: decryptedUser.username,
        email: decryptedUser.email,
        qrCodeId: decryptedUser.qrCodeId,
        authMethod: userAuthMethod,
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Log the login action
    await logUserAction(
      decryptedUser._id.toString(),
      "login",
      userAuthMethod,
      decryptedUser.qrCodeId,
      {
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
      },
    );

    // Return user data (excluding password) including QR code
    const { password: _, ...userWithoutPassword } = decryptedUser;

    return {
      success: true,
      message: "Login successful",
      token: token,
      user: userWithoutPassword,
      redirect: "/userhomepage",
    };
  } catch (error) {
    console.error("Login error:", error);

    // Format error message based on the specific error
    let errorMessage = error.message;

    // If the error is specifically "User not Found", format it without the "Login failed:" prefix
    // since it already clearly indicates the issue
    if (error.message === "User not Found") {
      errorMessage = "User not Found";
    } else {
      // For other errors, you can add the prefix if needed
      // errorMessage = `Login failed: ${error.message}`;
      errorMessage = error.message; // Using the original error message
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    console.log("No authorization header found");
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  // Check if it's in Bearer token format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.log("Invalid authorization header format:", authHeader);
    return res.status(401).json({
      success: false,
      message: "Invalid token format",
    });
  }

  const token = parts[1];

  if (!token) {
    console.log("No token found in authorization header");
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  console.log("Verifying token:", token.substring(0, 20) + "...");

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("JWT verification error:", err.message);
      return res.status(401).json({
        success: false,
        message: "Failed to authenticate token: " + err.message,
      });
    }

    console.log("Token decoded successfully, user:", decoded);
    req.user = decoded;
    next();
  });
}

module.exports = { loginUser, verifyToken };
