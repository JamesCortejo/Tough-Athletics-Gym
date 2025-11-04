// public/js/logout.js
class LogoutManager {
  constructor() {
    this.logoutConfirmModal = null;
    this.logoutSuccessModal = null;
    this.init();
  }

  init() {
    this.setupModalInstances();
    this.setupLogoutHandler();
    this.checkAuthentication();
  }

  setupModalInstances() {
    // Get modal instances if they exist
    const confirmModalEl = document.getElementById("logoutConfirmModal");
    const successModalEl = document.getElementById("logoutSuccessModal");

    if (confirmModalEl) {
      this.logoutConfirmModal = new bootstrap.Modal(confirmModalEl);
    }
    if (successModalEl) {
      this.logoutSuccessModal = new bootstrap.Modal(successModalEl);
    }
  }

  setupLogoutHandler() {
    const logoutBtn = document.getElementById("logoutBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showConfirmationModal();
      });
    }

    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener("click", () => {
        this.handleLogout();
      });
    }

    // Handle browser back button/refresh
    window.addEventListener("beforeunload", (e) => {
      // Optional: Add any cleanup here if needed
    });
  }

  showConfirmationModal() {
    if (this.logoutConfirmModal) {
      this.logoutConfirmModal.show();
    } else {
      // Fallback to classic confirm if modal not available
      this.handleLogout();
    }
  }

  showSuccessModal() {
    if (this.logoutSuccessModal) {
      this.logoutSuccessModal.show();

      // Auto-hide and redirect after 2 seconds
      setTimeout(() => {
        if (this.logoutSuccessModal) {
          this.logoutSuccessModal.hide();
        }
        this.redirectToLogin();
      }, 2000);
    } else {
      // Fallback to alert if modal not available
      alert("You have been logged out successfully!");
      this.redirectToLogin();
    }
  }

  async handleLogout() {
    try {
      // Close confirmation modal if open
      if (this.logoutConfirmModal) {
        this.logoutConfirmModal.hide();
      }

      // Show loading state on confirm button
      const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
      if (confirmLogoutBtn) {
        const originalText = confirmLogoutBtn.innerHTML;
        confirmLogoutBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-2"></i>Logging out...';
        confirmLogoutBtn.disabled = true;
      }

      // Get current user data from localStorage
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );
      const token = localStorage.getItem("token");

      console.log("=== CLIENT: Initiating logout ===");
      console.log("Current user:", currentUser);
      console.log("Token exists:", !!token);

      // If we have a token, call the logout API to log the action
      if (token && currentUser._id) {
        try {
          console.log("=== CLIENT: Calling logout API ===");
          console.log("Current user data:", {
            userId: currentUser._id,
            authMethod: currentUser.authMethod,
            qrCodeId: currentUser.qrCodeId,
          });

          const response = await fetch("/api/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          console.log(
            "=== CLIENT: Logout API response status ===",
            response.status
          );

          const result = await response.json();
          console.log("=== CLIENT: Logout API response ===", result);

          if (result.warning) {
            console.warn("Logout warning:", result.warning);
          }

          console.log("Server logout response:", result.message);
        } catch (apiError) {
          console.error("=== CLIENT: Error calling logout API ===", apiError);
          // Continue with client-side logout even if API call fails
        }
      } else {
        console.warn(
          "=== CLIENT: No token or user ID available for API call ===",
          { hasToken: !!token, hasUserId: !!(currentUser && currentUser._id) }
        );
      }

      // Clear all user data from localStorage
      this.clearUserData();

      // Show success modal
      this.showSuccessModal();

      console.log("=== CLIENT: Logout process completed ===");
    } catch (error) {
      console.error("=== CLIENT: Logout error ===", error);
      this.showError("Error during logout. Please try again.");

      // Re-enable button on error
      const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
      if (confirmLogoutBtn) {
        confirmLogoutBtn.innerHTML =
          '<i class="fas fa-sign-out-alt me-2"></i>Yes, Logout';
        confirmLogoutBtn.disabled = false;
      }
    }
  }

  redirectToLogin() {
    window.location.href = "../index.html";
  }

  clearUserData() {
    // Remove all user-related data from localStorage
    const itemsToRemove = [
      "currentUser",
      "token",
      "userProfile",
      "userSettings",
      "gymMembership",
    ];

    itemsToRemove.forEach((item) => {
      localStorage.removeItem(item);
    });

    // Also clear any sessionStorage if used
    sessionStorage.clear();
  }

  showError(message) {
    // Create error modal dynamically or use existing alert system
    const errorHtml = `
      <div class="modal fade" id="errorModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">
                <i class="fas fa-exclamation-triangle me-2"></i>Error
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4">
              <i class="fas fa-exclamation-circle text-danger" style="font-size: 48px;"></i>
              <h5 class="mt-3">${message}</h5>
            </div>
            <div class="modal-footer justify-content-center">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing error modal
    const existingErrorModal = document.getElementById("errorModal");
    if (existingErrorModal) {
      existingErrorModal.remove();
    }

    // Add new error modal to body
    document.body.insertAdjacentHTML("beforeend", errorHtml);

    // Show error modal
    const errorModal = new bootstrap.Modal(
      document.getElementById("errorModal")
    );
    errorModal.show();

    // Auto remove after 5 seconds
    setTimeout(() => {
      const modalElement = document.getElementById("errorModal");
      if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
          modalInstance.hide();
        }
        modalElement.remove();
      }
    }, 5000);
  }

  checkAuthentication() {
    const currentUser = localStorage.getItem("currentUser");
    const token = localStorage.getItem("token");

    if (!currentUser || !token) {
      console.log("No user logged in, redirecting to login page");
      this.redirectToLogin();
      return;
    }

    // Optional: Validate token expiration
    try {
      const tokenData = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = tokenData.exp * 1000; // Convert to milliseconds

      if (Date.now() >= expirationTime) {
        console.log("Token expired, auto-logging out");
        this.handleLogout();
      }
    } catch (error) {
      console.error("Error validating token:", error);
    }
  }
}

// Initialize logout manager when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  window.logoutManager = new LogoutManager();
});

// Export for use in other files if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = LogoutManager;
}
