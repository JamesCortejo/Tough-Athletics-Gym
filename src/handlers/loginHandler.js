const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "your_jwt_secret_key_here"; // Change this to a strong secret in production

async function loginUser(loginData) {
  console.log("Received login data:", loginData);

  try {
    const { username, password } = loginData;

    // Basic validation
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

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
    });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid username or password");
    }

    console.log("Password verified successfully");

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "24h" } // Token expires in 24 hours
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

// Middleware to verify JWT token (for future protected routes)
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer token

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid token.",
    });
  }
}

module.exports = { loginUser, verifyToken };
