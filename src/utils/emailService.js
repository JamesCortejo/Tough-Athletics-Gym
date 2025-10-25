const nodemailer = require("nodemailer");

// Create transporter (using your .env credentials)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "2301105714@student.buksu.edu.ph",
    pass: process.env.EMAIL_PASS || "ebtvzzirucbodarm",
  },
});

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetCode - 6-digit reset code
 * @returns {Promise<Object>} - Send result
 */
async function sendResetEmail(to, resetCode) {
  try {
    const mailOptions = {
      from:
        process.env.EMAIL_FROM ||
        '"Tough Athletics Gym" <no-reply@toughgym.com>',
      to: to,
      subject: "Password Reset Code - Tough Athletics Gym",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #333;">Tough Athletics Gym</h2>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 10px;">
            <h3 style="color: #333;">Password Reset Request</h3>
            <p>You requested to reset your password. Use the code below to verify your identity:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0d6efd; background: #e9ecef; padding: 15px; border-radius: 5px; display: inline-block;">
                ${resetCode}
              </div>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this reset, please ignore this email.</p>
          </div>
          <div style="margin-top: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>&copy; 2024 Tough Athletics Gym. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Reset email sent to ${to}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending reset email:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendResetEmail };
