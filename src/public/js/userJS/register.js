document.addEventListener("DOMContentLoaded", function () {
  const registerForm = document.querySelector("form");

  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Get form data
      const formData = {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        mobile: document.getElementById("mobile").value.trim(),
        gender: document.getElementById("gender").value,
        password: document.getElementById("password").value,
        confirmPassword: document.getElementById("confirmPassword").value,
      };

      // Client-side validation
      if (formData.password !== formData.confirmPassword) {
        showError("Passwords do not match!");
        return;
      }

      if (formData.password.length < 8) {
        showError("Password must be at least 8 characters long!");
        return;
      }

      // Enhanced password validation
      const passwordErrors = validatePasswordClient(formData.password);
      if (passwordErrors.length > 0) {
        showError("Password requirements:\n" + passwordErrors.join("\n"));
        return;
      }

      try {
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
        }
      } catch (error) {
        console.error("Error:", error);
        showError("An error occurred during registration. Please try again.");
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
});
