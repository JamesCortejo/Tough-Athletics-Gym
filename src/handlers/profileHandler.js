// src/handlers/profileHandler.js
const { connectToDatabase } = require("../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { ObjectId } = require("mongodb");

// Configure multer for file uploads - FIXED PATH
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use absolute path to src/public/images/pfpImages
    const uploadPath = path.join(
      process.cwd(),
      "src",
      "public",
      "images",
      "pfpImages"
    );
    console.log("Upload path:", uploadPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("Created directory:", uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    const fileName = "profile-" + uniqueSuffix + fileExtension;
    console.log("Generated filename:", fileName);
    cb(null, fileName);
  },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Update user profile information
async function updateUserProfile(profileData) {
  console.log("Received profile update data:", profileData);

  try {
    const { userId, firstName, lastName, email, age, gender } = profileData;

    // Basic validation
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!firstName || !lastName || !email) {
      throw new Error("First name, last name, and email are required");
    }

    const db = await connectToDatabase();
    console.log("Database connected successfully for profile update");

    const usersCollection = db.collection("users");

    // Check if email is already taken by another user
    const existingUser = await usersCollection.findOne({
      email: email,
      _id: { $ne: new ObjectId(userId) },
    });

    if (existingUser) {
      throw new Error("Email is already taken by another user");
    }

    // Update user profile
    const updateData = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      updatedAt: new Date(),
    };

    // Add optional fields if provided
    if (age) updateData.age = parseInt(age);
    if (gender) updateData.gender = gender;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    console.log("Profile updated successfully");

    // Get updated user data
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: "Profile updated successfully",
      user: userWithoutPassword,
    };
  } catch (error) {
    console.error("Profile update error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Update user profile picture
async function updateProfilePicture(userId, profilePicturePath) {
  try {
    if (!userId || !profilePicturePath) {
      throw new Error("User ID and profile picture path are required");
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Update profile picture path in database
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          profilePicture: profilePicturePath,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    // Get updated user data
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: "Profile picture updated successfully",
      user: userWithoutPassword,
    };
  } catch (error) {
    console.error("Profile picture update error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Handle profile picture upload
async function handleProfilePictureUpload(req, res) {
  try {
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    console.log("Uploaded file:", req.file);

    // Create relative path for frontend access
    const relativePath = `/images/pfpImages/${req.file.filename}`;
    console.log("Relative path for frontend:", relativePath);

    // Check if file actually exists
    if (!fs.existsSync(req.file.path)) {
      throw new Error("Uploaded file not found on server");
    }

    // Update database with new profile picture path
    const result = await updateProfilePicture(userId, relativePath);

    if (result.success) {
      console.log("Profile picture updated in database successfully");
      // Update localStorage data in response
      res.json({
        success: true,
        message: result.message,
        profilePicture: relativePath,
        user: result.user,
      });
    } else {
      // Delete uploaded file if database update failed
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Profile picture upload error:", error);

    // Delete uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Error uploading profile picture: " + error.message,
    });
  }
}

// Get user profile data
async function getUserProfile(userId) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword,
    };
  } catch (error) {
    console.error("Get user profile error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = {
  updateUserProfile,
  updateProfilePicture,
  handleProfilePictureUpload,
  getUserProfile,
  upload,
};
