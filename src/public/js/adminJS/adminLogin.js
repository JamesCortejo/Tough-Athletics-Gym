document.addEventListener("DOMContentLoaded", function () {
  const adminLoginForm = document.getElementById("adminLoginForm");

  // Check if already logged in
  checkExistingAdminAuth();

  adminLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Get form data
    const formData = {
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value,
    };

    // Client-side validation
    if (!formData.username || !formData.password) {
      showAlert("Username and password are required!", "danger");
      return;
    }

    try {
      // Show loading state
      const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Logging in...";
      submitBtn.disabled = true;

      console.log("Sending admin login request:", formData);

      const response = await fetch("/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      console.log("Admin login response:", result);

      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;

      if (result.success) {
        // Store admin JWT token and admin data in localStorage
        localStorage.setItem("adminToken", result.token);
        localStorage.setItem("currentAdmin", JSON.stringify(result.admin));

        console.log("Stored admin data:", result.admin);
        console.log("Admin token stored:", result.token ? "Yes" : "No");

        showSuccess(result.message);
        console.log("Redirecting to:", result.redirect);

        // Wait a moment to ensure localStorage is updated, then redirect
        setTimeout(() => {
          window.location.href = result.redirect;
        }, 500);
      } else {
        showError("Login failed: " + result.message);
      }
    } catch (error) {
      console.error("Error:", error);
      showError("An error occurred during login. Please try again.");

      // Reset button state on error too
      const submitBtn = adminLoginForm.querySelector('button[type="submit"]');
      submitBtn.textContent = "Login";
      submitBtn.disabled = false;
    }
  });

  function checkExistingAdminAuth() {
    const adminToken = localStorage.getItem("adminToken");
    const currentAdmin = localStorage.getItem("currentAdmin");

    if (adminToken && currentAdmin) {
      console.log("Admin already logged in, redirecting...");
      // Verify the token is still valid
      fetch("/admin/check-auth", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
        .then((response) => response.json())
        .then((result) => {
          if (result.success) {
            window.location.href = "/admin/overview";
          } else {
            // Token is invalid, clear storage
            localStorage.removeItem("adminToken");
            localStorage.removeItem("currentAdmin");
          }
        })
        .catch((error) => {
          console.error("Error checking auth:", error);
        });
    }
  }

  // Show error message
  function showError(message) {
    showAlert(message, "danger");
  }

  // Show success message
  function showSuccess(message) {
    showAlert(message, "success");
  }

  function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll(".alert");
    existingAlerts.forEach((alert) => alert.remove());

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;

    const alertContainer = document.getElementById("alertContainer");
    alertContainer.appendChild(alertDiv);
  }
});
