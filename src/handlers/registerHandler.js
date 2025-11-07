const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const { generateQRCode, generateQRCodeId } = require("../utils/qrGenerator");
const { verifyRecaptcha } = require("../utils/recaptcha");

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
  // Check if age is a number
  if (isNaN(age) || !Number.isInteger(age)) {
    return "Age must be a valid number";
  }

  // Check if age is within reasonable range (16-100)
  if (age < 16) {
    return "You must be at least 16 years old to register";
  }

  if (age > 100) {
    return "Please enter a valid age";
  }

  return null; // No errors
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
        `Security verification failed: ${recaptchaResult.message}`
      );
    }

    console.log(
      "reCAPTCHA verified successfully, score:",
      recaptchaResult.score
    );

    // Validate age
    const ageValidationError = validateAge(userData.age);
    if (ageValidationError) {
      throw new Error(ageValidationError);
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

    // Check if user already exists by email
    const existingEmail = await usersCollection.findOne({
      email: userData.email,
    });

    if (existingEmail) {
      throw new Error("User with this email already exists");
    }

    // Check if user already exists by username
    const existingUsername = await usersCollection.findOne({
      username: userData.username,
    });

    if (existingUsername) {
      throw new Error("User with this username already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    console.log("Password hashed successfully");

    // Generate unique QR code ID
    const qrCodeId = generateQRCodeId();
    console.log("Generated QR Code ID:", qrCodeId);

    // Prepare user document with new schema including age
    const userDocument = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      email: userData.email,
      mobile: userData.mobile,
      gender: userData.gender,
      age: userData.age, // Add age field
      password: hashedPassword,
      qrCodeId: qrCodeId,
      profilePicture: "/images/default-profile.png", // Default profile picture
      authMethod: "local", // Add authMethod for local login
      isAdmin: false, // Default to false
      isArchived: false, // Default to false
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("Attempting to insert user document:", userDocument);

    // Insert user into database
    const result = await usersCollection.insertOne(userDocument);
    console.log("Insert result:", result);

    // Generate QR Code after successful registration
    const userId = result.insertedId.toString();
    const qrCodePath = await generateQRCode(
      userId,
      userData.username,
      qrCodeId
    );

    // Update user document with QR code path
    await usersCollection.updateOne(
      { _id: result.insertedId },
      { $set: { qrCode: qrCodePath } }
    );

    console.log("QR code generated and user document updated");

    // Verify the document was inserted
    const insertedUser = await usersCollection.findOne({
      _id: result.insertedId,
    });
    console.log("Verified inserted user:", insertedUser);

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
