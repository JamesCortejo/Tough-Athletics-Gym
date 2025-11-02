// Common admin utilities and functions
class AdminCommon {
  constructor() {
    this.adminToken = localStorage.getItem("adminToken");
    this.currentAdmin = localStorage.getItem("currentAdmin");
    this.init();
  }

  init() {
    this.checkAuthentication();
    this.setupNavigation();
    this.displayAdminName();
  }

  checkAuthentication() {
    if (!this.adminToken || !this.currentAdmin) {
      window.location.href = "/admin/login";
      return false;
    }
    return true;
  }

  displayAdminName() {
    try {
      const adminData = JSON.parse(this.currentAdmin);
      const adminNameDisplay = document.getElementById("adminNameDisplay");

      if (adminData.firstName && adminData.lastName) {
        adminNameDisplay.textContent = `${adminData.firstName} ${adminData.lastName}`;
      } else if (adminData.username) {
        adminNameDisplay.textContent = adminData.username;
      } else {
        adminNameDisplay.textContent = "Administrator";
      }
    } catch (error) {
      console.error("Error displaying admin name:", error);
      const adminNameDisplay = document.getElementById("adminNameDisplay");
      if (adminNameDisplay) {
        adminNameDisplay.textContent = "Administrator";
      }
    }
  }

  setupNavigation() {
    // Overview button
    const overviewBtn = document.querySelector(".overview-btn");
    if (overviewBtn) {
      overviewBtn.addEventListener("click", () => {
        window.location.href = "/admin/overview";
      });
    }

    // Membership Manager button
    const membershipBtn = document.querySelector(".membership-btn");
    if (membershipBtn) {
      membershipBtn.addEventListener("click", () => {
        window.location.href = "/admin/membership";
      });
    }

    // Accounts Manager button
    const accountsBtn = document.querySelector(".accounts-btn");
    if (accountsBtn) {
      accountsBtn.addEventListener("click", () => {
        // Update this when you create the accounts manager page
        window.location.href = "/admin/accounts";
      });
    }

    // Reports Manager button
    const reportsBtn = document.querySelector(".reports-btn");
    if (reportsBtn) {
      reportsBtn.addEventListener("click", () => {
        // Update this when you create the reports manager page
        window.location.href = "/admin/reports";
      });
    }

    // Logout button
    const logoutBtn = document.querySelector(".logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.showLogoutModal();
      });
    }
  }

  showLogoutModal() {
    // Create logout modal if it doesn't exist
    if (!document.getElementById("logoutModal")) {
      this.createLogoutModal();
    }
    document.getElementById("logoutModal").style.display = "flex";
  }

  createLogoutModal() {
    const modalHTML = `
            <div id="logoutModal" class="logout-modal">
                <div class="logout-modal-content">
                    <h4>Confirm Logout</h4>
                    <p>Are you sure you want to log out?</p>
                    <div class="logout-modal-buttons">
                        <button id="logoutCancelBtn" class="logout-cancel-btn">Cancel</button>
                        <button id="logoutConfirmBtn" class="logout-confirm-btn">Yes, Logout</button>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Add event listeners
    document
      .getElementById("logoutConfirmBtn")
      .addEventListener("click", () => {
        this.handleLogout();
      });
    document.getElementById("logoutCancelBtn").addEventListener("click", () => {
      this.hideLogoutModal();
    });
  }

  hideLogoutModal() {
    const modal = document.getElementById("logoutModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  handleLogout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("currentAdmin");
    window.location.href = "/admin/login";
  }

  showLoading(show) {
    let loadingOverlay = document.getElementById("loadingOverlay");
    if (!loadingOverlay) {
      loadingOverlay = document.createElement("div");
      loadingOverlay.id = "loadingOverlay";
      loadingOverlay.className = "loading-overlay";
      loadingOverlay.innerHTML = `
                <div class="spinner"></div>
                <p class="mt-2 text-white">Loading...</p>
            `;
      document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = show ? "flex" : "none";
  }

  showAlert(message, type) {
    let alertContainer = document.getElementById("alertContainer");
    if (!alertContainer) {
      alertContainer = document.createElement("div");
      alertContainer.id = "alertContainer";
      alertContainer.className = "alert-container";
      document.body.insertBefore(alertContainer, document.body.firstChild);
    }

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    alertContainer.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }

  // Get admin data
  getAdminData() {
    try {
      return JSON.parse(this.currentAdmin);
    } catch (error) {
      console.error("Error parsing admin data:", error);
      return null;
    }
  }

  // Get admin token
  getAdminToken() {
    return this.adminToken;
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  window.adminCommon = new AdminCommon();
});
