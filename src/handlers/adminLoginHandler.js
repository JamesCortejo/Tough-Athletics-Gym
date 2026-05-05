const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const encryptionService = require("../utils/encryptionService"); // ADD THIS IMPORT

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || "your_jwt_secret_key_here";

async function adminLogin(loginData) {
  console.log("Received admin login data:", loginData);

  try {
    const { username, password } = loginData;

    // Basic validation
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    const db = await connectToDatabase();
    console.log("Database connected successfully for admin login");

    const usersCollection = db.collection("users");

    // Find user by username and check if admin
    const user = await usersCollection.findOne({
      username: username,
      isAdmin: true, // Only allow admin users
    });

    if (!user) {
      throw new Error("Invalid admin credentials or insufficient privileges");
    }

    console.log("Admin user found:", {
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isAssistant: user.isAssistant || false,
    });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid username or password");
    }

    console.log("Admin password verified successfully");

    // DECRYPT ADMIN DATA
    const decryptedUser = encryptionService.decryptObject(user, [
      "email",
      "mobile",
    ]);

    // Generate JWT token with admin role
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        email: decryptedUser.email, // Use decrypted email
        isAdmin: true,
        isAssistant: user.isAssistant || false,
        role: user.isAssistant ? "assistant" : "admin",
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Return admin data (excluding password) - use decrypted data
    const { password: _, ...adminWithoutPassword } = user;
    adminWithoutPassword.email = decryptedUser.email;
    adminWithoutPassword.mobile = decryptedUser.mobile;

    return {
      success: true,
      message: "Admin login successful",
      token: token,
      admin: adminWithoutPassword,
      redirect: "/admin/overview",
    };
  } catch (error) {
    console.error("Admin login error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Middleware to verify admin JWT token
function verifyAdminToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer token

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user is admin
    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid token.",
    });
  }
}

module.exports = { adminLogin, verifyAdminToken };
