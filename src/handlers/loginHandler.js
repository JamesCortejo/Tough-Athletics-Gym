const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verifyRecaptcha } = require("../utils/recaptcha");
const { logUserAction } = require("../utils/userActionLogger");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

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
        `reCAPTCHA verification failed: ${recaptchaResult.message}`
      );
    }

    console.log(
      "reCAPTCHA verified successfully, score:",
      recaptchaResult.score
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
      throw new Error("Invalid username or password");
    }

    console.log("User found:", {
      username: user.username,
      email: user.email,
      qrCodeId: user.qrCodeId,
      profilePicture: user.profilePicture,
      authMethod: user.authMethod, // Log the authMethod
    });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid username or password");
    }

    console.log("Password verified successfully");

    // FIXED: Ensure authMethod is properly included in JWT
    const userAuthMethod = user.authMethod || "local";

    // Generate JWT token - ADD authMethod HERE
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        qrCodeId: user.qrCodeId,
        authMethod: userAuthMethod, // THIS IS CRITICAL - use the variable
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Log the login action
    await logUserAction(
      user._id.toString(),
      "login",
      userAuthMethod, // Use the same variable
      user.qrCodeId,
      {
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
      }
    );

    // Return user data (excluding password) including QR code
    const { password: _, ...userWithoutPassword } = user;

    return {
      success: true,
      message: "Login successful",
      token: token,
      user: userWithoutPassword,
      redirect: "/userhomepage",
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message: error.message,
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
