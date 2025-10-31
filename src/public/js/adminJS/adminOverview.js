document.addEventListener("DOMContentLoaded", function () {
  console.log("Admin Overview page loaded");
  initializeAdminPage();
});

async function initializeAdminPage() {
  showLoading(true);

  try {
    const isAuthenticated = await checkAdminAuth();

    if (isAuthenticated) {
      loadAdminData();
      setupEventListeners();
      showLoading(false);
    } else {
      showLoading(false);
      showAlert("Please log in as admin to access this page", "warning");
      setTimeout(() => {
        window.location.href = "/admin/login";
      }, 2000);
    }
  } catch (error) {
    console.error("Error initializing admin page:", error);
    showLoading(false);
    showAlert("Error loading admin dashboard", "danger");
  }
}

async function checkAdminAuth() {
  const adminToken = localStorage.getItem("adminToken");
  const currentAdmin = JSON.parse(localStorage.getItem("currentAdmin"));

  console.log("Checking admin auth...");
  console.log("Admin token exists:", !!adminToken);
  console.log("Current admin exists:", !!currentAdmin);

  if (!adminToken || !currentAdmin) {
    console.log("No admin token or admin data found");
    return false;
  }

  try {
    // Verify the token is still valid with the server
    const response = await fetch("/admin/check-auth", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    console.log("Auth check result:", result);

    if (result.success) {
      console.log("Admin is authenticated");
      return true;
    } else {
      console.log("Admin token invalid:", result.message);
      // Clear invalid tokens
      localStorage.removeItem("adminToken");
      localStorage.removeItem("currentAdmin");
      return false;
    }
  } catch (error) {
    console.error("Error checking admin auth:", error);
    return false;
  }
}

function loadAdminData() {
  const currentAdmin = JSON.parse(localStorage.getItem("currentAdmin"));

  if (currentAdmin) {
    document.getElementById("adminName").textContent =
      (currentAdmin.firstName || "Admin") + " " + (currentAdmin.lastName || "");
    document.getElementById("adminEmail").textContent =
      currentAdmin.email || "admin@example.com";
    document.getElementById("adminRole").textContent = currentAdmin.isAdmin
      ? "Administrator"
      : "User";
  }

  // Load dashboard statistics
  loadDashboardStats();
}

function loadDashboardStats() {
  const adminToken = localStorage.getItem("adminToken");

  // Example: Fetch dashboard data from server
  fetch("/admin/data", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        console.log("Admin data loaded:", result);
        updateDashboardWithRealData();
      } else {
        showAlert("Error loading dashboard data: " + result.message, "danger");
      }
    })
    .catch((error) => {
      console.error("Error loading dashboard data:", error);
      showAlert("Error loading dashboard data", "danger");
    });
}

function updateDashboardWithRealData() {
  // This is where you would update with real data from your database
  // For now, using placeholder data
  document.getElementById("totalMembers").textContent = "150";
  document.getElementById("activeMembers").textContent = "120";
  document.getElementById("pendingMembers").textContent = "15";
  document.getElementById("expiredMembers").textContent = "15";
}

function setupEventListeners() {
  // Logout button - Show confirmation modal
  document.querySelector(".logout-btn").addEventListener("click", function () {
    showLogoutConfirmation();
  });

  // Logout confirmation modal buttons
  document
    .getElementById("logoutCancelBtn")
    .addEventListener("click", function () {
      hideLogoutConfirmation();
    });

  document
    .getElementById("logoutConfirmBtn")
    .addEventListener("click", function () {
      performLogout();
    });

  // Close modal when clicking outside
  document
    .getElementById("logoutModal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        hideLogoutConfirmation();
      }
    });

  // Navigation buttons
  document
    .querySelector(".overview-btn")
    .addEventListener("click", function () {
      // Already on overview
    });

  // FIXED: Redirect to membership manager instead of showing alert
  document
    .querySelector(".membership-btn")
    .addEventListener("click", function () {
      window.location.href = "/admin/membership-manager";
    });

  document
    .querySelector(".accounts-btn")
    .addEventListener("click", function () {
      showAlert("Accounts Manager - Coming Soon", "info");
    });

  document.querySelector(".reports-btn").addEventListener("click", function () {
    showAlert("Reports Manager - Coming Soon", "info");
  });
}

function showLogoutConfirmation() {
  const logoutModal = document.getElementById("logoutModal");
  logoutModal.style.display = "flex";
}

function hideLogoutConfirmation() {
  const logoutModal = document.getElementById("logoutModal");
  logoutModal.style.display = "none";
}

function performLogout() {
  hideLogoutConfirmation();

  const adminToken = localStorage.getItem("adminToken");

  // Show loading state
  showLoading(true);

  if (adminToken) {
    fetch("/admin/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((result) => {
        console.log("Logout result:", result);
      })
      .catch((error) => {
        console.error("Logout error:", error);
      })
      .finally(() => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("currentAdmin");
        showLoading(false);
        window.location.href = "/admin/login";
      });
  } else {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("currentAdmin");
    showLoading(false);
    window.location.href = "/admin/login";
  }
}

function showLoading(show) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = show ? "flex" : "none";
}

function showAlert(message, type) {
  const alertContainer = document.getElementById("alertContainer");
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
