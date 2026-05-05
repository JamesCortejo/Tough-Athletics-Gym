// src/handlers/profileHandler.js
const { connectToDatabase } = require("../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { ObjectId } = require("mongodb");
const encryptionService = require("../utils/encryptionService");

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
]);

// Configure multer for file uploads - FIXED PATH
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use absolute path to src/public/images/pfpImages
    const uploadPath = path.join(
      process.cwd(),
      "src",
      "public",
      "images",
      "pfpImages",
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

// File filter for images only with specific types
const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only image files are allowed (JPEG, JPG, PNG, GIF, WebP, SVG)",
      ),
      false,
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (updated from 5MB)
  },
});

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate age range
function isValidAge(age) {
  const ageText = String(age ?? "").trim();
  if (!/^\d+$/.test(ageText)) {
    return false;
  }

  const ageNum = Number(ageText);
  return Number.isInteger(ageNum) && ageNum >= 16 && ageNum <= 100;
}

// Validate name (no special characters, only letters and basic punctuation)
function isValidName(name) {
  const nameRegex = /^[A-Za-z\s\-'.]+$/;
  return nameRegex.test(name) && name.length >= 2 && name.length <= 50;
}

function isValidFirstName(firstName) {
  const firstNameRegex = /^[A-Za-z\s-]+$/;
  return (
    firstNameRegex.test(firstName) &&
    firstName.trim().length >= 2 &&
    firstName.trim().length <= 50
  );
}

function isValidLastName(lastName) {
  const lastNameRegex = /^[A-Za-z\s-]+$/;
  return (
    lastNameRegex.test(lastName) &&
    lastName.trim().length >= 2 &&
    lastName.trim().length <= 50
  );
}

function isValidMobileForCompletion(mobile) {
  return /^09\d{9}$/.test(mobile);
}

// Update user profile information
async function updateUserProfile(profileData) {
  console.log("Received profile update data:", profileData);

  try {
    const { userId, firstName, lastName, email, mobile, age, gender } =
      profileData;

    // Basic validation
    if (!userId) {
      throw new Error("User ID is required");
    }

    // For profile completion, only require mobile, gender, and age
    // For regular profile updates, require name and email
    const isProfileCompletion = !firstName && !lastName && !email;

    if (!isProfileCompletion) {
      // Validate required fields
      if (!firstName || !lastName || !email) {
        throw new Error(
          "First name, last name, and email are required for profile updates",
        );
      }

      // Validate name format
      if (!isValidFirstName(firstName)) {
        throw new Error(
          "First name must contain only letters, spaces, and hyphens, and be between 2-50 characters",
        );
      }

      if (!isValidLastName(lastName)) {
        throw new Error(
          "Last name must contain only letters, spaces, and hyphens, and be between 2-50 characters",
        );
      }

      // Validate email format
      if (!isValidEmail(email)) {
        throw new Error("Please enter a valid email address");
      }
    }

    // For OAuth profile completion, mobile is optional but must be 11 digits if provided
    if (isProfileCompletion && mobile && mobile.trim() !== "") {
      const mobileDigits = mobile.replace(/\D/g, "");
      if (!isValidMobileForCompletion(mobileDigits)) {
        throw new Error("Mobile number must be 11 digits and start with 09");
      }
    }

    // Validate age if provided
    if (age) {
      if (!isValidAge(age)) {
        throw new Error("Age must be a number between 16 and 100");
      }
    }

    const db = await connectToDatabase();
    console.log("Database connected successfully for profile update");

    const usersCollection = db.collection("users");

    // If email is being updated, check if it's already taken by another user
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailLookupHash = encryptionService.createLookupHash(normalizedEmail);

      let existingUser = await usersCollection.findOne(
        {
          emailLookupHash: emailLookupHash,
          _id: { $ne: new ObjectId(userId) },
        },
        {
          projection: {
            _id: 1,
            email: 1,
          },
        },
      );

      if (!existingUser) {
        const usersWithoutLookupHash = await usersCollection
          .find(
            {
              _id: { $ne: new ObjectId(userId) },
              email: { $exists: true, $ne: null },
              $or: [{ emailLookupHash: { $exists: false } }, { emailLookupHash: null }],
            },
            {
              projection: {
                _id: 1,
                email: 1,
              },
            },
          )
          .toArray();

        existingUser = usersWithoutLookupHash.find((candidateUser) => {
          try {
            const decryptedEmail = encryptionService.decrypt(candidateUser.email);
            return (
              decryptedEmail && decryptedEmail.toLowerCase().trim() === normalizedEmail
            );
          } catch (decryptionError) {
            return false;
          }
        });
      }

      if (existingUser) {
        let existingEmailDisplay = normalizedEmail;
        try {
          const decryptedExistingEmail = encryptionService.decrypt(existingUser.email);
          if (decryptedExistingEmail) {
            existingEmailDisplay = decryptedExistingEmail;
          }
        } catch (decryptionError) {
          existingEmailDisplay = normalizedEmail;
        }

        throw new Error(
          `Email: "${existingEmailDisplay}" (belongs to user ID "${existingUser._id.toString()}")`,
        );
      }
    }

    // Update user profile
    const updateData = {
      updatedAt: new Date(),
    };

    // Add fields if provided
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      updateData.email = encryptionService.encrypt(email.trim()); // Encrypt new email
      updateData.emailLookupHash = encryptionService.createLookupHash(normalizedEmail); // Keep lookup hash in sync
    }
    if (mobile) updateData.mobile = encryptionService.encrypt(mobile); // Encrypt new mobile
    if (age) updateData.age = parseInt(age);
    if (gender) updateData.gender = gender;

    // For profile completion, mark as completed
    if (isProfileCompletion && gender && age) {
      updateData.needsProfileCompletion = false;
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    console.log("Profile updated successfully");

    // Get updated user data
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!updatedUser) {
      throw new Error("Failed to retrieve updated user data");
    }

    // Decrypt sensitive data before returning
    const decryptedUser = encryptionService.decryptObject(updatedUser, [
      "email",
      "mobile",
      "googleId",
      "facebookId",
    ]);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = decryptedUser;

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

    // Validate file path exists
    const fullPath = path.join(
      process.cwd(),
      "src",
      "public",
      profilePicturePath,
    );

    if (!fs.existsSync(fullPath)) {
      throw new Error("Profile picture file not found on server");
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Get current user to check if they have an existing profile picture
    const currentUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Delete old profile picture if it exists and is not the default
    if (
      currentUser.profilePicture &&
      !currentUser.profilePicture.includes("defaultPfp.png")
    ) {
      const oldPicturePath = path.join(
        process.cwd(),
        "src",
        "public",
        currentUser.profilePicture,
      );

      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
        console.log("Deleted old profile picture:", oldPicturePath);
      }
    }

    // Update profile picture path in database
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          profilePicture: profilePicturePath,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }

    // Get updated user data
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!updatedUser) {
      throw new Error("Failed to retrieve updated user data");
    }

    // Decrypt sensitive data before returning
    const decryptedUser = encryptionService.decryptObject(updatedUser, [
      "email",
      "mobile",
      "googleId",
      "facebookId",
    ]);

    const { password: _, ...userWithoutPassword } = decryptedUser;

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

// Handle profile picture upload with additional validation
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

    console.log("Uploaded file details:", {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
    });

    // Additional validation for file size (client-side might fail)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      // Delete uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "File size must be less than 10MB",
      });
    }

    // Validate file format from mimetype and extension (defense in depth)
    const fileExtension = path.extname(req.file.originalname || "").toLowerCase();
    if (
      !ALLOWED_IMAGE_MIME_TYPES.has(req.file.mimetype) ||
      !ALLOWED_IMAGE_EXTENSIONS.has(fileExtension)
    ) {
      // Delete uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "File is not a valid image",
      });
    }

    // Check if file actually exists
    if (!fs.existsSync(req.file.path)) {
      throw new Error("Uploaded file not found on server");
    }

    // Create relative path for frontend access
    const relativePath = `/images/pfpImages/${req.file.filename}`;
    console.log("Relative path for frontend:", relativePath);

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

    // Validate ObjectId format
    if (!ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID format");
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if account is archived
    if (user.isArchived) {
      throw new Error("This account has been archived");
    }

    // Decrypt ALL sensitive data including OAuth IDs
    const decryptedUser = encryptionService.decryptObject(user, [
      "email",
      "mobile",
      "googleId",
      "facebookId",
    ]);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = decryptedUser;

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

// Delete profile picture (optional functionality)
async function deleteProfilePicture(userId) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Get current user
    const currentUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check if user has a custom profile picture
    if (
      currentUser.profilePicture &&
      !currentUser.profilePicture.includes("defaultPfp.png")
    ) {
      const picturePath = path.join(
        process.cwd(),
        "src",
        "public",
        currentUser.profilePicture,
      );

      // Delete the file if it exists
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
        console.log("Deleted profile picture:", picturePath);
      }

      // Set to default profile picture
      const defaultPicture = "/images/pfpImages/defaultPfp.png";
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            profilePicture: defaultPicture,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        throw new Error("Failed to update user");
      }

      return {
        success: true,
        message: "Profile picture deleted successfully",
        profilePicture: defaultPicture,
      };
    }

    return {
      success: true,
      message: "No custom profile picture to delete",
      profilePicture: currentUser.profilePicture,
    };
  } catch (error) {
    console.error("Delete profile picture error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

// Validate profile data before update (can be used by other handlers)
async function validateProfileData(profileData) {
  const errors = [];

  // Validate firstName
  if (profileData.firstName) {
    if (!isValidName(profileData.firstName)) {
      errors.push(
        "First name must contain only letters and be between 2-50 characters",
      );
    }
  }

  // Validate lastName
  if (profileData.lastName) {
    if (!isValidName(profileData.lastName)) {
      errors.push(
        "Last name must contain only letters and be between 2-50 characters",
      );
    }
  }

  // Validate email
  if (profileData.email) {
    if (!isValidEmail(profileData.email)) {
      errors.push("Please enter a valid email address");
    }
  }

  // Validate age
  if (profileData.age) {
    if (!isValidAge(profileData.age)) {
      errors.push("Age must be between 16 and 100");
    }
  }

  // Validate mobile number format (basic validation)
  if (profileData.mobile) {
    const mobileRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!mobileRegex.test(profileData.mobile)) {
      errors.push("Please enter a valid mobile number");
    }
  }

  // Validate gender
  if (profileData.gender) {
    const validGenders = ["male", "female", "other", "prefer-not-to-say"];
    if (!validGenders.includes(profileData.gender)) {
      errors.push("Please select a valid gender option");
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

module.exports = {
  updateUserProfile,
  updateProfilePicture,
  handleProfilePictureUpload,
  getUserProfile,
  deleteProfilePicture,
  validateProfileData,
  upload,
  isValidEmail,
  isValidAge,
  isValidName,
};
