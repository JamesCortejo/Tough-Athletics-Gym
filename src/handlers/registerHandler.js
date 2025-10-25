const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const { generateQRCode, generateQRCodeId } = require("../utils/qrGenerator"); // Updated path

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

async function registerUser(userData) {
  console.log("Received user data:", userData);

  try {
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

    // Prepare user document with new schema
    const userDocument = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      email: userData.email,
      mobile: userData.mobile,
      gender: userData.gender,
      password: hashedPassword,
      qrCodeId: qrCodeId,
      profilePicture: "/images/default-profile.png", // Default profile picture
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
