document.addEventListener("DOMContentLoaded", function () {
  let recaptchaSiteKey = "";
  const form = document.getElementById("forgotPasswordForm");

  // Load reCAPTCHA configuration
  async function loadRecaptchaConfig() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      recaptchaSiteKey = config.recaptchaSiteKey;

      // Load reCAPTCHA script
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
      document.head.appendChild(script);

      console.log("reCAPTCHA script loaded with key:", recaptchaSiteKey);
    } catch (error) {
      console.error("Failed to load reCAPTCHA config:", error);
      showError(
        "Security verification failed to load. Please refresh the page."
      );
    }
  }

  // Function to get reCAPTCHA token
  async function getRecaptchaToken() {
    return new Promise((resolve) => {
      if (typeof grecaptcha === "undefined") {
        console.error("reCAPTCHA not loaded");
        resolve(null);
        return;
      }

      if (!recaptchaSiteKey) {
        console.error("reCAPTCHA site key not available");
        resolve(null);
        return;
      }

      grecaptcha.ready(function () {
        grecaptcha
          .execute(recaptchaSiteKey, { action: "password_reset" })
          .then(function (token) {
            console.log("reCAPTCHA token obtained:", token);
            resolve(token);
          })
          .catch(function (error) {
            console.error("reCAPTCHA error:", error);
            resolve(null);
          });
      });
    });
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const submitBtn = form.querySelector('button[type="submit"]');

      // Remove existing alerts
      removeExistingAlerts();

      if (!email) {
        showError("Please enter your email address");
        return;
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError("Please enter a valid email address");
        return;
      }

      try {
        // Show loading state
        submitBtn.textContent = "Verifying...";
        submitBtn.disabled = true;

        // Wait a moment for reCAPTCHA to be ready if needed
        if (typeof grecaptcha === "undefined") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken();

        if (!recaptchaToken) {
          showError(
            "Security verification failed. Please refresh the page and try again."
          );
          submitBtn.textContent = "Get Code";
          submitBtn.disabled = false;
          return;
        }

        console.log("Sending forgot password request with reCAPTCHA");

        const response = await fetch("/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            recaptchaToken: recaptchaToken,
          }),
        });

        const result = await response.json();

        if (result.success) {
          showSuccess(result.message);
          // Disable the form after successful submission
          submitBtn.disabled = true;
          // Redirect to verify email page
          setTimeout(() => {
            window.location.href = result.redirect;
          }, 2000);
        } else {
          showError(result.message);
          submitBtn.textContent = "Get Code";
          submitBtn.disabled = false;
        }
      } catch (error) {
        console.error("Error:", error);
        showError("An error occurred. Please try again.");
        submitBtn.textContent = "Get Code";
        submitBtn.disabled = false;
      }
    });
  }

  function showError(message) {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-danger";
    alertDiv.innerHTML = `
            <div style="padding-right: 30px;">${message}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%);"></button>
        `;
    form.parentNode.insertBefore(alertDiv, form);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv);
      }
    }, 5000);
  }

  function showSuccess(message) {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-success";
    alertDiv.innerHTML = `
            <div style="padding-right: 30px;">${message}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%);"></button>
        `;
    form.parentNode.insertBefore(alertDiv, form);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv);
      }
    }, 5000);
  }

  function removeExistingAlerts() {
    const alerts = document.querySelectorAll(".alert");
    alerts.forEach((alert) => alert.remove());
  }

  // Initialize reCAPTCHA
  loadRecaptchaConfig();
});
