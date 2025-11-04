require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("./src/config/passport"); // Unified passport config

const app = express();

// Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret_here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from src/public
app.use(express.static(path.join(__dirname, "src", "public")));

// Static file serving for external libraries
app.use(
  "/fonts",
  express.static(
    path.join(
      __dirname,
      "node_modules",
      "@fontsource",
      "league-gothic",
      "files"
    )
  )
);

app.use(
  "/lib/html5-qrcode",
  express.static(path.join(__dirname, "node_modules/html5-qrcode"))
);

app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "node_modules", "bootstrap", "dist"))
);

// API Routes
app.get("/api/config", (req, res) => {
  res.json({
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
  });
});

// Import route handlers
const { loginUser, verifyToken } = require("./src/handlers/loginHandler");
const {
  updateUserProfile,
  handleProfilePictureUpload,
  getUserProfile,
  upload,
} = require("./src/handlers/profileHandler");

// Mount routes
const authRoutes = require("./src/routes/authroutes");
app.use("/", authRoutes);

const adminRoutes = require("./src/routes/adminroutes");
app.use("/", adminRoutes);

const activeMembersRoutes = require("./src/routes/activeMembersRoutes");
app.use("/api/admin", activeMembersRoutes);

const membershipRoutes = require("./src/routes/membershipRoutes");
app.use("/api/membership", membershipRoutes);

const checkinRoutes = require("./src/routes/checkinRoutes");
app.use("/api/membership", checkinRoutes);

const membershipUtilsRoutes = require("./src/routes/membershipUtilsRoutes");
app.use("/api/membership-utils", membershipUtilsRoutes);

const notificationRoutes = require("./src/routes/notificationRoutes");
app.use("/api/notifications", notificationRoutes);

// Profile Routes
app.get("/profile", verifyToken, async (req, res) => {
  try {
    const result = await getUserProfile(req.user.userId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.post("/profile/update", verifyToken, async (req, res) => {
  try {
    console.log("Profile update request received");
    console.log("User from token:", req.user);
    console.log("Request body:", req.body);

    const profileData = {
      userId: req.user.userId,
      ...req.body,
    };

    console.log("Profile data to update:", profileData);

    const result = await updateUserProfile(profileData);

    console.log("Update result:", result);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Profile update route error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Update profile picture
app.post(
  "/profile/picture",
  verifyToken,
  upload.single("profilePicture"),
  (req, res) => {
    req.body.userId = req.user.userId;
    handleProfilePictureUpload(req, res);
  }
);

// User Pages Routes
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "index.html")
  );
});

app.get("/userhomepage", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "userhomepage.html")
  );
});

app.get("/usermembership", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "usermembership.html")
  );
});

app.get("/usermembershipbasic", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "src",
      "public",
      "user_pages",
      "usermembershipbasic.html"
    )
  );
});

app.get("/usermembershippremium", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "src",
      "public",
      "user_pages",
      "usermembershippremium.html"
    )
  );
});

app.get("/usermembershipvip", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "src",
      "public",
      "user_pages",
      "usermembershipvip.html"
    )
  );
});

app.get("/userprofile", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "userprofile.html")
  );
});

app.get("/usersettings", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "usersettings.html")
  );
});

app.get("/usermembershipstatus", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "src",
      "public",
      "user_pages",
      "usermembershipstatus.html"
    )
  );
});

app.get("/privacy-policy", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "privacy-policy.html")
  );
});

app.get("/data-deletion", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "data-deletion.html")
  );
});

// Admin Pages Routes
app.get("/admin/overview", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "admin_pages", "adminOverview.html")
  );
});

app.get("/admin/membership-manager", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "src",
      "public",
      "admin_pages",
      "adminMembershipManager.html"
    )
  );
});

app.get("/admin/account-manager", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "src",
      "public",
      "admin_pages",
      "adminAccountManager.html"
    )
  );
});

app.get("/admin/reports-manager", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "admin_pages", "adminReports.html")
  );
});

// Debug route
app.post("/debug-token", (req, res) => {
  const authHeader = req.headers["authorization"];
  console.log("Debug - Authorization header:", authHeader);

  if (!authHeader) {
    return res.json({ success: false, message: "No authorization header" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Debug - Token:", token);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Debug - Decoded token:", decoded);
    res.json({ success: true, decoded });
  } catch (error) {
    console.log("Debug - Token error:", error.message);
    res.json({ success: false, error: error.message });
  }
});

// Server startup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  console.log(`Make sure MongoDB is running on localhost:27017`);
});
