const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const { generateQRCode, generateQRCodeId } = require("../utils/qrGenerator");
const { verifyRecaptcha } = require("../utils/recaptcha");
const encryptionService = require("../utils/encryptionService");
const crypto = require("crypto"); // Add this import

function validatePassword(password) {
  // Check minimum length
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  // Check for at least one uppercase letter
  if (!/(?=.*[A-Z])/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  // Check for at least one lowercase letter
  if (!/(?=.*[a-z])/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  // Check for at least one number
  if (!/(?=.*\d)/.test(password)) {
    return "Password must contain at least one number";
  }

  // Check for at least one special character
  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    return "Password must contain at least one special character";
  }

  return null; // No errors
}

function validateAge(age) {
  // Check if age is a valid number (including decimal check)
  const ageNum = Number(age);

  // Check if age is NaN (Not a Number)
  if (isNaN(ageNum)) {
    return "Age must be a valid number";
  }

  // Check if age is a whole number (no decimals)
  if (!Number.isInteger(ageNum)) {
    return "Age must be a whole number (no decimals allowed)";
  }

  // Check if age is within reasonable range (16-100)
  if (ageNum < 16) {
    return "You must be at least 16 years old to register";
  }

  if (ageNum > 100) {
    return "Please enter a valid age";
  }

  return null; // No errors
}

function validateUsername(username) {
  // Trim whitespace from username
  const trimmedUsername = username.trim();

  // Check if username is empty after trimming
  if (trimmedUsername.length === 0) {
    return "Username cannot be empty";
  }

  // Check minimum length
  if (trimmedUsername.length < 3) {
    return "Username must be at least 3 characters long";
  }

  // Check maximum length
  if (trimmedUsername.length > 30) {
    return "Username must be at most 30 characters long";
  }

  // Main validation: only allow alphanumeric, underscore, dot, hyphen
  // Using a clearer pattern with explicit character classes
  if (!/^[a-zA-Z0-9]+[a-zA-Z0-9_.-]*[a-zA-Z0-9]+$/.test(trimmedUsername)) {
    return "Username must start and end with a letter or number, and can only contain letters, numbers, underscores, dots, or hyphens in between";
  }

  // Check for consecutive special characters
  if (/(\.\.|--|__)/.test(trimmedUsername)) {
    return "Username cannot have consecutive dots, hyphens, or underscores";
  }

  // Check for reserved usernames
  const reservedUsernames = [
    "admin",
    "administrator",
    "root",
    "system",
    "support",
    "help",
    "null",
    "undefined",
    "me",
    "self",
    "user",
    "username",
  ];

  if (reservedUsernames.includes(trimmedUsername.toLowerCase())) {
    return "This username is not allowed";
  }

  return null; // No errors
}

function validateEmail(email) {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || email.trim() === "") {
    return "Email is required";
  }

  const trimmedEmail = email.trim();

  if (!emailRegex.test(trimmedEmail)) {
    return "Please enter a valid email address";
  }

  // Additional validation for common email issues
  if (trimmedEmail.length > 254) {
    return "Email address is too long";
  }

  // Check for multiple @ symbols
  if ((trimmedEmail.match(/@/g) || []).length > 1) {
    return "Email address cannot contain multiple @ symbols";
  }

  return null; // No errors
}

function validateMobile(mobile) {
  // If mobile is not provided, it's optional, so no error
  if (!mobile || mobile.trim() === "") {
    return null;
  }

  // Remove any non-digit characters (spaces, hyphens, parentheses, etc.)
  const digitsOnly = mobile.replace(/\D/g, "");

  // Check if it contains only digits
  if (!/^\d+$/.test(digitsOnly)) {
    return "Phone number must contain only digits";
  }

  // Check if it's exactly 11 digits
  if (digitsOnly.length !== 11) {
    return "Phone number must be exactly 11 digits long";
  }

  // Check if it starts with 09
  if (!/^09\d{9}$/.test(digitsOnly)) {
    return "Phone number must start with 09";
  }

  return null; // No errors
}

// Helper function to create SHA-256 hash for duplicate checking
function createLookupHash(text) {
  if (!text) return null;

  // Normalize by trimming and converting to lowercase
  const normalizedText = text.toString().trim().toLowerCase();

  // Create SHA-256 hash
  return crypto.createHash("sha256").update(normalizedText).digest("hex");
}

async function registerUser(userData) {
  console.log("Received user data:", userData);

  try {
    // Verify reCAPTCHA first
    if (!userData.recaptchaToken) {
      throw new Error("reCAPTCHA verification required");
    }

    const recaptchaResult = await verifyRecaptcha(userData.recaptchaToken);
    if (!recaptchaResult.success) {
      console.error("reCAPTCHA verification failed:", recaptchaResult.message);
      throw new Error(
        `Security verification failed: ${recaptchaResult.message}`,
      );
    }

    console.log(
      "reCAPTCHA verified successfully, score:",
      recaptchaResult.score,
    );

    // Validate email format
    const emailValidationError = validateEmail(userData.email);
    if (emailValidationError) {
      throw new Error(emailValidationError);
    }

    // Trim and validate username
    const trimmedUsername = userData.username.trim();
    const usernameValidationError = validateUsername(trimmedUsername);
    if (usernameValidationError) {
      throw new Error(usernameValidationError);
    }

    // Update userData with trimmed username
    userData.username = trimmedUsername;

    // Validate age
    const ageValidationError = validateAge(userData.age);
    if (ageValidationError) {
      throw new Error(ageValidationError);
    }

    // Validate mobile number if provided
    const mobileValidationError = validateMobile(userData.mobile);
    if (mobileValidationError) {
      throw new Error(mobileValidationError);
    }

    // Validate password match
    if (userData.password !== userData.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // Validate password strength
    const passwordValidationError = validatePassword(userData.password);
    if (passwordValidationError) {
      throw new Error(passwordValidationError);
    }

    const db = await connectToDatabase();
    console.log("Database connected successfully");

    const usersCollection = db.collection("users");
    console.log("Using 'users' collection");

    // Create email hash for duplicate checking
    const emailLookupHash = createLookupHash(userData.email);

    // Check if user already exists by email using lookup hash
    const existingEmail = await usersCollection.findOne({
      emailLookupHash: emailLookupHash,
    });

    if (existingEmail) {
      throw new Error("User with this email already exists");
    }

    // Check if user already exists by username (case-insensitive check)
    const existingUsername = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") },
    });

    if (existingUsername) {
      throw new Error("User with this username already exists");
    }

    // Check if user already exists by mobile number (if provided)
    if (userData.mobile && userData.mobile.trim() !== "") {
      const mobileLookupHash = createLookupHash(userData.mobile);
      const existingMobile = await usersCollection.findOne({
        mobileLookupHash: mobileLookupHash,
      });

      if (existingMobile) {
        throw new Error("User with this phone number already exists");
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    console.log("Password hashed successfully");

    // Generate unique QR code ID
    const qrCodeId = generateQRCodeId();
    console.log("Generated QR Code ID:", qrCodeId);

    // Create lookup hashes for duplicate checking
    const emailLookupHashForStorage = createLookupHash(userData.email);
    const mobileLookupHashForStorage =
      userData.mobile && userData.mobile.trim() !== ""
        ? createLookupHash(userData.mobile)
        : null;

    // Encrypt sensitive data before storing
    const encryptedEmail = encryptionService.encrypt(userData.email);
    const encryptedMobile =
      userData.mobile && userData.mobile.trim() !== ""
        ? encryptionService.encrypt(userData.mobile)
        : null;

    // Prepare user document with new schema
    const userDocument = {
      firstName: userData.firstName.trim(),
      lastName: userData.lastName.trim(),
      username: trimmedUsername,
      email: encryptedEmail,
      emailLookupHash: emailLookupHashForStorage,
      mobile: encryptedMobile,
      mobileLookupHash: mobileLookupHashForStorage,
      gender: userData.gender,
      age: parseInt(userData.age),
      password: hashedPassword,
      qrCodeId: qrCodeId,
      profilePicture: "/images/pfpImages/defaultPfp.png",
      authMethod: "local",
      isAdmin: false,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      "Attempting to insert user document (excluding sensitive data):",
      {
        firstName: userDocument.firstName,
        lastName: userDocument.lastName,
        username: userDocument.username,
        email: "[ENCRYPTED]",
        emailLookupHash: userDocument.emailLookupHash,
        mobile: userDocument.mobile ? "[ENCRYPTED]" : null,
        mobileLookupHash: userDocument.mobileLookupHash,
        gender: userDocument.gender,
        age: userDocument.age,
        password: "[HASHED]",
        qrCodeId: userDocument.qrCodeId,
        profilePicture: userDocument.profilePicture,
        authMethod: userDocument.authMethod,
        isAdmin: userDocument.isAdmin,
        isArchived: userDocument.isArchived,
        createdAt: userDocument.createdAt,
      },
    );

    // Insert user into database
    const result = await usersCollection.insertOne(userDocument);
    console.log("Insert result:", result);

    // Generate QR Code after successful registration
    const userId = result.insertedId.toString();
    const qrCodePath = await generateQRCode(userId, trimmedUsername, qrCodeId);

    // Update user document with QR code path
    await usersCollection.updateOne(
      { _id: result.insertedId },
      { $set: { qrCode: qrCodePath } },
    );

    console.log("QR code generated and user document updated");

    // Verify the document was inserted
    const insertedUser = await usersCollection.findOne(
      {
        _id: result.insertedId,
      },
      {
        projection: {
          password: 0,
          email: 0,
          mobile: 0,
        },
      },
    );
    console.log(
      "Verified inserted user (excluding sensitive data):",
      insertedUser,
    );

    return {
      success: true,
      message: "User registered successfully",
      userId: result.insertedId,
      qrCodeId: qrCodeId,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = { registerUser };
