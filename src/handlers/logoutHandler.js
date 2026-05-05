// handlers/logoutHandler.js
const { logUserAction } = require("../utils/userActionLogger");

async function logoutUser(userId, authMethod, qrCodeId, requestInfo = {}) {
  try {
    console.log(`=== LOGOUT PROCESS STARTED ===`);
    console.log(`User ID: ${userId}`);
    console.log(`Auth Method: ${authMethod}`);
    console.log(`QR Code ID: ${qrCodeId}`);
    console.log(`IP Address: ${requestInfo.ipAddress}`);
    console.log(`User Agent: ${requestInfo.userAgent}`);

    // Validate required parameters
    if (!userId) {
      console.error("ERROR: User ID is required for logout logging");
      return {
        success: false,
        message: "User ID is required",
      };
    }

    // FIX: Properly handle authMethod parameter
    let finalAuthMethod = authMethod;
    if (
      !finalAuthMethod ||
      finalAuthMethod === "undefined" ||
      finalAuthMethod === "null"
    ) {
      console.warn('WARNING: authMethod not provided, defaulting to "local"');
      finalAuthMethod = "local";
    }

    if (!qrCodeId) {
      console.warn("WARNING: qrCodeId not provided");
    }

    // Log the logout action
    console.log("Calling logUserAction with:", {
      userId,
      actionType: "logout",
      authMethod: finalAuthMethod,
      qrCodeId,
      additionalData: {
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        logoutType: "manual",
      },
    });

    const logResult = await logUserAction(
      userId,
      "logout",
      finalAuthMethod, // Use the properly handled authMethod
      qrCodeId,
      {
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        logoutType: "manual",
      }
    );

    if (logResult) {
      console.log(`✓ Logout action logged successfully for user: ${userId}`);
      console.log(`=== LOGOUT PROCESS COMPLETED ===`);
      return {
        success: true,
        message: "Logout successful",
      };
    } else {
      console.error(`✗ Failed to log logout action for user: ${userId}`);
      console.log(`=== LOGOUT PROCESS COMPLETED WITH WARNING ===`);
      return {
        success: false,
        message: "Logout completed but action not logged",
      };
    }
  } catch (error) {
    console.error("ERROR in logoutUser function:", error);
    console.log(`=== LOGOUT PROCESS FAILED ===`);
    return {
      success: false,
      message: "Error logging logout action: " + error.message,
    };
  }
}

module.exports = {
  logoutUser,
};
