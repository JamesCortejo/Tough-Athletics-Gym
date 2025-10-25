// server.js (at project root)
const express = require("express");
const path = require("path");

const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from src/public
app.use(express.static(path.join(__dirname, "src", "public")));

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

// Serve Bootstrap
app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "node_modules", "bootstrap", "dist"))
);

// Import handlers
const { loginUser, verifyToken } = require("./src/handlers/loginHandler");
const {
  updateUserProfile,
  handleProfilePictureUpload,
  getUserProfile,
  upload,
} = require("./src/handlers/profileHandler");

// Fix: Mount auth routes correctly
const authRoutes = require("./src/routes/authroutes");
app.use("/", authRoutes);

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

// Update user profile
app.post("/profile/update", verifyToken, async (req, res) => {
  try {
    const profileData = {
      userId: req.user.userId,
      ...req.body,
    };

    const result = await updateUserProfile(profileData);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
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

// Homepage route
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "src", "public", "user_pages", "index.html")
  );
});

const adminRoutes = require("./src/routes/adminroutes");
app.use("/", adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://192.168.0.192:${PORT}`);
  console.log(`Make sure MongoDB is running on localhost:27017`);
});
