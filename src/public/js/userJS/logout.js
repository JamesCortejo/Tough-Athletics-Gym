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
  }

  showConfirmationModal() {
    if (this.logoutConfirmModal) {
      this.logoutConfirmModal.show();
    } else {
      this.handleLogout();
    }
  }

  showSuccessModal() {
    if (this.logoutSuccessModal) {
      this.logoutSuccessModal.show();
      setTimeout(() => {
        if (this.logoutSuccessModal) {
          this.logoutSuccessModal.hide();
        }
        this.redirectToLogin();
      }, 2000);
    } else {
      alert("You have been logged out successfully!");
      this.redirectToLogin();
    }
  }

  // NEW METHOD: Show error modal and redirect after 2 seconds
  showErrorAndRedirect(message) {
    // Create a temporary error modal if not already present
    const errorModalId = "logoutErrorModal";
    let errorModalEl = document.getElementById(errorModalId);
    if (errorModalEl) {
      errorModalEl.remove();
    }

    const errorHtml = `
      <div class="modal fade" id="${errorModalId}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">
                <i class="fas fa-exclamation-triangle me-2"></i>Logout Error
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4">
              <i class="fas fa-exclamation-circle text-danger" style="font-size: 48px;"></i>
              <h5 class="mt-3">${message}</h5>
              <p class="text-muted mt-2">Redirecting to login page...</p>
              <div class="spinner-border text-danger mt-3" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", errorHtml);
    errorModalEl = document.getElementById(errorModalId);
    const errorModal = new bootstrap.Modal(errorModalEl);
    errorModal.show();

    // Auto-hide and redirect after 2 seconds
    setTimeout(() => {
      errorModal.hide();
      setTimeout(() => {
        errorModalEl.remove();
        this.redirectToLogin();
      }, 150); // Wait for modal to fully close
    }, 2000);
  }

  async handleLogout() {
    try {
      // Close confirmation modal if open
      if (this.logoutConfirmModal) {
        this.logoutConfirmModal.hide();
      }

      // Disable confirm button to prevent double click
      const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
      if (confirmLogoutBtn) {
        confirmLogoutBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-2"></i>Logging out...';
        confirmLogoutBtn.disabled = true;
      }

      // Get current user data from localStorage
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}",
      );
      const token = localStorage.getItem("token");

      console.log("=== CLIENT: Initiating logout ===");
      console.log("Current user:", currentUser);
      console.log("Token exists:", !!token);

      // Call the logout API if token exists
      let apiSuccess = false;
      if (token && currentUser._id) {
        try {
          console.log("=== CLIENT: Calling logout API ===");
          const response = await fetch("/api/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          console.log(
            "=== CLIENT: Logout API response status ===",
            response.status,
          );

          // Check if response is ok (status 2xx)
          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              "Server responded with error:",
              response.status,
              errorText,
            );
            throw new Error(`Server returned ${response.status}`);
          }

          const result = await response.json();
          console.log("=== CLIENT: Logout API response ===", result);
          apiSuccess = true;
        } catch (apiError) {
          // This catches network errors, timeouts, and non-2xx responses
          console.error("=== CLIENT: Error calling logout API ===", apiError);
          // Do NOT re-throw; we will continue with client-side cleanup
          // but show error modal instead of success modal
        }
      } else {
        console.warn(
          "=== CLIENT: No token or user ID available for API call ===",
        );
      }

      // Always clear client-side data
      this.clearUserData();

      // Determine which modal to show based on API success
      if (apiSuccess) {
        this.showSuccessModal();
      } else {
        // API call failed or was skipped – show error modal with message
        this.showErrorAndRedirect("Error during logout. Please try again.");
      }

      // Re-enable logout button if not already redirected (button may be gone after redirect)
      if (confirmLogoutBtn) {
        confirmLogoutBtn.innerHTML =
          '<i class="fas fa-sign-out-alt me-2"></i>Yes, Logout';
        confirmLogoutBtn.disabled = false;
      }

      console.log("=== CLIENT: Logout process completed ===");
    } catch (error) {
      // Catch any unexpected errors from the outer block
      console.error("=== CLIENT: Unexpected logout error ===", error);
      this.showErrorAndRedirect(
        "An unexpected error occurred. Please try again.",
      );

      // Re-enable button
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
    sessionStorage.clear();
  }

  showError(message) {
    // Keep original showError for backward compatibility (but not used in main flow)
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

    const existingErrorModal = document.getElementById("errorModal");
    if (existingErrorModal) {
      existingErrorModal.remove();
    }

    document.body.insertAdjacentHTML("beforeend", errorHtml);
    const errorModal = new bootstrap.Modal(
      document.getElementById("errorModal"),
    );
    errorModal.show();

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

    try {
      const tokenData = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = tokenData.exp * 1000;
      if (Date.now() >= expirationTime) {
        console.log("Token expired, auto-logging out");
        this.handleLogout();
      }
    } catch (error) {
      console.error("Error validating token:", error);
    }
  }
}

// Initialize logout manager
document.addEventListener("DOMContentLoaded", function () {
  window.logoutManager = new LogoutManager();
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = LogoutManager;
}