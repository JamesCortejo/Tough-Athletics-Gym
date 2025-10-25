// public/js/login.js
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.querySelector("form");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Get form data
      const formData = {
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value,
      };

      // Client-side validation
      if (!formData.username || !formData.password) {
        showError("Username and password are required!");
        return;
      }

      try {
        // Show loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Logging in...";
        submitBtn.disabled = true;

        console.log("Sending login request:", formData);

        const response = await fetch("/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();
        console.log("Login response:", result);

        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

        if (result.success) {
          // Store JWT token and user data in localStorage
          localStorage.setItem("token", result.token);
          localStorage.setItem("currentUser", JSON.stringify(result.user));

          console.log("Stored user data:", result.user);
          console.log("QR Code path:", result.user.qrCode);
          console.log("First Name:", result.user.firstName);

          showSuccess(result.message);
          console.log("Redirecting to:", result.redirect);

          // Redirect immediately
          window.location.href = result.redirect;
        } else {
          showError("Login failed: " + result.message);
        }
      } catch (error) {
        console.error("Error:", error);
        showError("An error occurred during login. Please try again.");

        // Reset button state on error too
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.textContent = "Login";
        submitBtn.disabled = false;
      }
    });
  }

  // Show error message
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

  // Show success message
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

  // Remove existing alerts
  function removeExistingAlerts() {
    const existingAlerts = document.querySelectorAll(".alert");
    existingAlerts.forEach((alert) => {
      if (!alert.id || alert.id !== "registrationSuccessAlert") {
        alert.remove();
      }
    });
  }
});
