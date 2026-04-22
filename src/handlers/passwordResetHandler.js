const { connectToDatabase } = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

/**
 * Generate a 6-digit reset code
 * @returns {string} - 6-digit code
 */
function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Helper function to create SHA-256 hash for lookup (same as in registerHandler.js)
 */
function createLookupHash(text) {
  if (!text) return null;

  // Normalize by trimming and converting to lowercase
  const normalizedText = text.toString().trim().toLowerCase();

  // Create SHA-256 hash
  return crypto.createHash("sha256").update(normalizedText).digest("hex");
}

/**
 * Check if email exists in database using lookup hash
 * @param {string} email - User's email
 * @returns {Promise<Object>} - User object if exists, null otherwise
 */
async function checkEmailExists(email) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Create lookup hash for the email (same method as in registerHandler.js)
    const emailLookupHash = createLookupHash(email);

    // Find user by email lookup hash
    const user = await usersCollection.findOne({
      emailLookupHash: emailLookupHash,
    });

    return user;
  } catch (error) {
    console.error("Error checking email:", error);
    throw error;
  }
}

/**
 * Store reset code in database with expiration
 * @param {string} email - User's email
 * @param {string} resetCode - 6-digit reset code
 * @returns {Promise<Object>} - Result of operation
 */
async function storeResetCode(email, resetCode) {
  try {
    const db = await connectToDatabase();
    const resetCodesCollection = db.collection("resetCodes");

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create lookup hash for the email
    const emailLookupHash = createLookupHash(email);

    // Store the reset code with lookup hash
    const result = await resetCodesCollection.insertOne({
      emailLookupHash: emailLookupHash,
      code: resetCode,
      expiresAt: expiresAt,
      createdAt: new Date(),
      used: false,
    });

    return { success: true, result };
  } catch (error) {
    console.error("Error storing reset code:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify reset code
 * @param {string} email - User's email
 * @param {string} code - Reset code to verify
 * @returns {Promise<Object>} - Verification result
 */
async function verifyResetCode(email, code) {
  try {
    const db = await connectToDatabase();
    const resetCodesCollection = db.collection("resetCodes");

    // Create lookup hash for the email
    const emailLookupHash = createLookupHash(email);

    // Find valid, unused, unexpired code
    const resetCode = await resetCodesCollection.findOne({
      emailLookupHash: emailLookupHash,
      code: code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetCode) {
      return {
        success: false,
        message: "Invalid or expired reset code",
      };
    }

    // Mark code as used
    await resetCodesCollection.updateOne(
      { _id: resetCode._id },
      { $set: { used: true, usedAt: new Date() } },
    );

    return { success: true, message: "Code verified successfully" };
  } catch (error) {
    console.error("Error verifying reset code:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user password
 * @param {string} email - User's email
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - Update result
 */
async function updatePassword(email, newPassword) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    // Create lookup hash for the email
    const emailLookupHash = createLookupHash(email);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password using lookup hash
    const result = await usersCollection.updateOne(
      { emailLookupHash: emailLookupHash },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount === 0) {
      return {
        success: false,
        message: "User not found or password not updated",
      };
    }

    return {
      success: true,
      message: "Password updated successfully",
    };
  } catch (error) {
    console.error("Error updating password:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result
 */
function validatePassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/(?=.*\d)/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

module.exports = {
  generateResetCode,
  checkEmailExists,
  storeResetCode,
  verifyResetCode,
  updatePassword,
  validatePassword,
  createLookupHash, // Export for use in other files if needed
};
