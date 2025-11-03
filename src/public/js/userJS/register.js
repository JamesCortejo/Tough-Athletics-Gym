// public/js/userJS/register.js
document.addEventListener("DOMContentLoaded", function () {
  let recaptchaSiteKey = "";
  const registerForm = document.querySelector("form");

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
          .execute(recaptchaSiteKey, { action: "register" })
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

  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Show loading state
      const submitBtn = registerForm.querySelector('button[type="submit"]');
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
          firstName: document.getElementById("firstName").value.trim(),
          lastName: document.getElementById("lastName").value.trim(),
          username: document.getElementById("username").value.trim(),
          email: document.getElementById("email").value.trim(),
          mobile: document.getElementById("mobile").value.trim(),
          gender: document.getElementById("gender").value,
          age: parseInt(document.getElementById("age").value), // Add age
          password: document.getElementById("password").value,
          confirmPassword: document.getElementById("confirmPassword").value,
          recaptchaToken: recaptchaToken,
        };

        // Client-side validation
        if (formData.password !== formData.confirmPassword) {
          showError("Passwords do not match!");
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        if (formData.password.length < 8) {
          showError("Password must be at least 8 characters long!");
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        // Age validation
        if (!formData.age || formData.age < 16 || formData.age > 100) {
          showError("Age must be between 16 and 100!");
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        // Enhanced password validation
        const passwordErrors = validatePasswordClient(formData.password);
        if (passwordErrors.length > 0) {
          showError("Password requirements:\n" + passwordErrors.join("\n"));
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        console.log("Sending registration request with reCAPTCHA");

        const response = await fetch("/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (result.success) {
          showSuccess(result.message);
          // Redirect to index page with success parameter
          setTimeout(() => {
            window.location.href = "/?registration=success";
          }, 2000);
        } else {
          showError("Registration failed: " + result.message);
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        console.error("Error:", error);
        showError("An error occurred during registration. Please try again.");
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Client-side password validation function
  function validatePasswordClient(password) {
    const errors = [];

    if (password.length < 8) {
      errors.push("• At least 8 characters long");
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push("• One uppercase letter");
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push("• One lowercase letter");
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push("• One number");
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
      errors.push("• One special character");
    }

    return errors;
  }

  // Update the showError and showSuccess functions in register.js
  function showError(message) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-danger alert-dismissible fade show";
    alertDiv.innerHTML = `
        <div style="padding-right: 30px;">${message}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Insert alert at the top of the form
    const formContainer = document.querySelector(".formContainer");
    const form = formContainer.querySelector("form");
    formContainer.insertBefore(alertDiv, form);

    // Auto scroll to alert on mobile
    alertDiv.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showSuccess(message) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-success alert-dismissible fade show";
    alertDiv.innerHTML = `
        <div style="padding-right: 30px;">${message}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    const form = formContainer.querySelector("form");
    formContainer.insertBefore(alertDiv, form);

    // Disable form after successful registration
    registerForm.querySelector('button[type="submit"]').disabled = true;

    // Auto scroll to alert on mobile
    alertDiv.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Remove existing alerts
  function removeExistingAlerts() {
    const existingAlerts = document.querySelectorAll(".alert");
    existingAlerts.forEach((alert) => alert.remove());
  }

  // Initialize reCAPTCHA
  loadRecaptchaConfig();
});
