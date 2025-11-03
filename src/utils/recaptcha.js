const axios = require("axios");

async function verifyRecaptcha(token) {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY not found in environment variables");
      return { success: false, message: "reCAPTCHA configuration error" };
    }

    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );

    const data = response.data;

    console.log("reCAPTCHA verification response:", data);

    if (data.success) {
      return {
        success: true,
        score: data.score,
        action: data.action,
      };
    } else {
      return {
        success: false,
        message: "reCAPTCHA verification failed",
        errors: data["error-codes"],
      };
    }
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return {
      success: false,
      message: "Error verifying reCAPTCHA",
    };
  }
}

module.exports = { verifyRecaptcha };
