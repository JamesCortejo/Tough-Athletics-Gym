// public/js/login.js
document.addEventListener("DOMContentLoaded", function () {
  let recaptchaSiteKey = "";
  const loginForm = document.querySelector("form");

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
          .execute(recaptchaSiteKey, { action: "login" })
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

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Show loading state
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Verifying...";
      submitBtn.disabled = true;

      try {
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
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        // Get form data
        const formData = {
          username: document.getElementById("username").value.trim(),
          password: document.getElementById("password").value,
          recaptchaToken: recaptchaToken,
        };

        // Client-side validation
        if (!formData.username || !formData.password) {
          showError("Username and password are required!");
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        console.log("Sending login request with reCAPTCHA");

        const response = await fetch("/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();
        console.log("Login response:", result);

        if (result.success) {
          // Store JWT token and user data in localStorage
          localStorage.setItem("token", result.token);
          localStorage.setItem("currentUser", JSON.stringify(result.user));

          console.log("Stored user data:", result.user);
          showSuccess(result.message);
          console.log("Redirecting to:", result.redirect);

          // Redirect immediately
          window.location.href = result.redirect;
        } else {
          showError("Login failed: " + result.message);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        console.error("Error:", error);
        showError("An error occurred during login. Please try again.");
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Rest of your existing functions (showError, showSuccess, removeExistingAlerts)
  function showError(message) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-danger alert-dismissible fade show";
    alertDiv.style.cssText = "margin: 10px 0; width: 100%; max-width: 100%;";
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    if (formContainer) {
      const form = formContainer.querySelector("form");
      if (form) {
        formContainer.insertBefore(alertDiv, form);
      } else {
        formContainer.appendChild(alertDiv);
      }
    }
  }

  function showSuccess(message) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-success alert-dismissible fade show";
    alertDiv.style.cssText = "margin: 10px 0; width: 100%; max-width: 100%;";
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    if (formContainer) {
      const form = formContainer.querySelector("form");
      if (form) {
        formContainer.insertBefore(alertDiv, form);
      } else {
        formContainer.appendChild(alertDiv);
      }
    }
  }

  function removeExistingAlerts() {
    const existingAlerts = document.querySelectorAll(".alert");
    existingAlerts.forEach((alert) => {
      if (!alert.id || alert.id !== "registrationSuccessAlert") {
        alert.remove();
      }
    });
  }

  // Initialize reCAPTCHA
  loadRecaptchaConfig();
});
