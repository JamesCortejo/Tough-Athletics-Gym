// src/utils/qrGenerator.js
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

/**
 * Generates a QR code for a user and saves it as an image file
 * @param {string} userId - MongoDB user ID
 * @param {string} username - User's username
 * @param {string} qrCodeId - Unique QR code identifier
 * @returns {Promise<string>} - Path to the generated QR code image
 */
async function generateQRCode(userId, username, qrCodeId) {
  try {
    // Create QR code data
    const qrData = JSON.stringify({
      qrCodeId: qrCodeId,
      userId: userId,
      username: username,
      type: "gym_membership",
      timestamp: new Date().toISOString(),
      version: "1.0",
    });

    // Define QR code directory and file path
    const qrDir = path.join(__dirname, "..", "public", "images", "qrImages");
    const qrFilePath = path.join(qrDir, `${qrCodeId}.png`);

    // Ensure directory exists
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
      console.log("Created QR code directory:", qrDir);
    }

    // Generate QR code with smaller size
    await QRCode.toFile(qrFilePath, qrData, {
      color: {
        dark: "#000000", // Black dots
        light: "#FFFFFF", // White background
      },
      width: 250, // Reduced from 400 to 250
      margin: 1, // Reduced margin
      errorCorrectionLevel: "H", // High error correction
      type: "png",
    });

    console.log(`QR code generated successfully: ${qrFilePath}`);
    return `/images/qrImages/${qrCodeId}.png`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code: " + error.message);
  }
}

/**
 * Generates a unique QR code ID
 * @returns {string} - Unique QR code identifier
 */
function generateQRCodeId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `QR_${timestamp}_${random}`.toUpperCase();
}

/**
 * Deletes a QR code file (for future use if needed)
 * @param {string} qrCodeId - QR code identifier
 * @returns {Promise<boolean>} - Success status
 */
async function deleteQRCode(qrCodeId) {
  try {
    const qrDir = path.join(__dirname, "..", "public", "images", "qrImages");
    const qrFilePath = path.join(qrDir, `${qrCodeId}.png`);

    if (fs.existsSync(qrFilePath)) {
      fs.unlinkSync(qrFilePath);
      console.log(`QR code deleted: ${qrFilePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting QR code:", error);
    return false;
  }
}

module.exports = {
  generateQRCode,
  generateQRCodeId,
  deleteQRCode,
};
