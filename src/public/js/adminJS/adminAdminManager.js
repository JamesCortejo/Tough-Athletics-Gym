// adminAdminManager.js
class AdminManager {
  constructor() {
    this.adminToken = localStorage.getItem("adminToken");
    this.currentAdmin = JSON.parse(
      localStorage.getItem("currentAdmin") || "{}"
    );
    this.selectedUser = null;
    this.currentAction = null;
    this.targetAdminId = null;
    this.searchTimeout = null;
    this.allUsers = [];

    this.initializeEventListeners();
    this.checkPermissions();
  }

  initializeEventListeners() {
    // Admin Management Button
    document
      .querySelector(".admin-management-btn")
      ?.addEventListener("click", () => {
        this.openAdminManagementModal();
      });

    // Search functionality
    document.getElementById("userSearch")?.addEventListener("input", (e) => {
      this.handleUserSearch(e.target.value);
    });

    document
      .getElementById("clearUserSearch")
      ?.addEventListener("click", () => {
        this.clearUserSearch();
      });

    // Promote button
    document.getElementById("promoteUserBtn")?.addEventListener("click", () => {
      this.showPromoteSecurityConfirmation();
    });

    // Security confirmation
    document
      .getElementById("confirmAdminActionBtn")
      ?.addEventListener("click", () => {
        this.handleAdminActionConfirmation();
      });

    // Role change
    document.getElementById("adminRole")?.addEventListener("change", () => {
      this.updatePromoteButtonState();
    });
  }

  checkPermissions() {
    // Check if current admin is an assistant (they shouldn't have access to this feature)
    if (this.currentAdmin.isAssistant) {
      this.disableAdminManagement();
    }
  }

  disableAdminManagement() {
    const adminManagementBtn = document.querySelector(".admin-management-btn");
    if (adminManagementBtn) {
      adminManagementBtn.disabled = true;
      adminManagementBtn.innerHTML =
        '<i class="fas fa-ban me-2"></i>Admin Management (Restricted)';
      adminManagementBtn.title =
        "Assistant admins cannot manage admin accounts";
    }
  }

  async openAdminManagementModal() {
    if (this.currentAdmin.isAssistant) {
      this.showAlert(
        "Assistant admins are not authorized to manage admin accounts.",
        "warning"
      );
      return;
    }

    this.showLoading(true);

    try {
      await Promise.all([this.loadAllUsers(), this.loadCurrentAdmins()]);

      const modal = new bootstrap.Modal(
        document.getElementById("adminManagementModal")
      );
      modal.show();

      // Clear previous selections
      this.clearUserSelection();
    } catch (error) {
      console.error("Error opening admin management modal:", error);
      this.showAlert("Error loading admin management data.", "danger");
    } finally {
      this.showLoading(false);
    }
  }

  async loadAllUsers() {
    try {
      const response = await fetch("/api/accounts/admin/accounts", {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.allUsers = result.users;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      this.showAlert("Error loading users.", "danger");
      this.allUsers = [];
    }
  }

  async loadCurrentAdmins() {
    try {
      const response = await fetch("/api/accounts/admin/admins", {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.displayCurrentAdmins(result.admins);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error loading admins:", error);
      this.showAlert("Error loading current admins.", "danger");
      this.displayCurrentAdmins([]);
    }
  }

  displayCurrentAdmins(admins) {
    const adminsList = document.getElementById("currentAdminsList");
    const noAdminsMessage = document.getElementById("noAdminsMessage");

    if (admins.length === 0) {
      adminsList.innerHTML = "";
      noAdminsMessage.style.display = "block";
      return;
    }

    noAdminsMessage.style.display = "none";

    adminsList.innerHTML = admins
      .map((admin) => {
        const isCurrentUser = admin._id === this.currentAdmin._id;
        const roleBadge = admin.isAssistant
          ? '<span class="badge badge-assistant">Assistant Admin</span>'
          : '<span class="badge badge-admin">Full Admin</span>';

        const currentUserBadge = isCurrentUser
          ? '<span class="current-user-badge">Current User</span>'
          : "";

        const actions = isCurrentUser
          ? '<td><span class="text-muted small">Current session</span></td>'
          : `
            <td>
                <div class="admin-actions">
                    ${
                      !admin.isAssistant
                        ? `
                        <button class="btn btn-demote demote-to-assistant-btn" 
                                data-admin-id="${admin._id}" 
                                data-admin-name="${admin.firstName} ${admin.lastName}">
                            <i class="fas fa-user-minus me-1"></i>Make Assistant
                        </button>
                    `
                        : ""
                    }
                    
                    ${
                      admin.isAssistant
                        ? `
                        <button class="btn btn-promote promote-to-admin-btn" 
                                data-admin-id="${admin._id}" 
                                data-admin-name="${admin.firstName} ${admin.lastName}">
                            <i class="fas fa-user-plus me-1"></i>Make Full Admin
                        </button>
                    `
                        : ""
                    }
                    
                    <button class="btn btn-revoke revoke-admin-btn" 
                            data-admin-id="${admin._id}" 
                            data-admin-name="${admin.firstName} ${
              admin.lastName
            }">
                        <i class="fas fa-user-times me-1"></i>Revoke
                    </button>
                </div>
            </td>
            `;

        const initials = `${admin.firstName?.charAt(0) || ""}${
          admin.lastName?.charAt(0) || ""
        }`.toUpperCase();
        const rowClass = isCurrentUser ? "current-user-indicator" : "";

        return `
            <tr class="${rowClass}">
                <td>
                    <div class="admin-user-info">
                        <div class="admin-avatar">${initials}</div>
                        <div class="admin-details">
                            <div class="admin-name">${admin.firstName} ${
          admin.lastName
        } ${currentUserBadge}</div>
                            <div class="admin-username">@${admin.username} • ${
          admin.email
        }</div>
                        </div>
                    </div>
                </td>
                <td>${roleBadge}</td>
                <td>${this.formatDate(new Date(admin.createdAt))}</td>
                ${actions}
            </tr>
        `;
      })
      .join("");

    // Add event listeners to action buttons
    this.attachAdminActionListeners();
  }

  attachAdminActionListeners() {
    // Demote to assistant
    document.querySelectorAll(".demote-to-assistant-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const adminId = e.target
          .closest("button")
          .getAttribute("data-admin-id");
        const adminName = e.target
          .closest("button")
          .getAttribute("data-admin-name");
        this.showChangeRoleSecurityConfirmation(
          adminId,
          adminName,
          "assistant"
        );
      });
    });

    // Promote to full admin
    document.querySelectorAll(".promote-to-admin-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const adminId = e.target
          .closest("button")
          .getAttribute("data-admin-id");
        const adminName = e.target
          .closest("button")
          .getAttribute("data-admin-name");
        this.showChangeRoleSecurityConfirmation(adminId, adminName, "admin");
      });
    });

    // Revoke admin
    document.querySelectorAll(".revoke-admin-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const adminId = e.target
          .closest("button")
          .getAttribute("data-admin-id");
        const adminName = e.target
          .closest("button")
          .getAttribute("data-admin-name");
        this.showRevokeSecurityConfirmation(adminId, adminName);
      });
    });
  }

  handleUserSearch(searchTerm) {
    const clearSearchBtn = document.getElementById("clearUserSearch");

    // Show/hide clear button
    if (searchTerm.trim() && clearSearchBtn) {
      clearSearchBtn.style.display = "flex";
    } else if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    // Debounce search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.searchUsers(searchTerm);
    }, 300);
  }

  searchUsers(searchTerm) {
    const searchResults = document.getElementById("userSearchResults");

    if (!searchTerm.trim()) {
      searchResults.style.display = "none";
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    // Filter users who are not already admins
    const filteredUsers = this.allUsers.filter((user) => {
      if (user.isAdmin) return false; // Skip existing admins

      const searchableFields = [
        user.firstName,
        user.lastName,
        user.email,
        user.username,
      ]
        .filter((field) => field)
        .map((field) => field.toLowerCase());

      return searchableFields.some((field) => field.includes(term));
    });

    this.displaySearchResults(filteredUsers);
  }

  displaySearchResults(users) {
    const searchResults = document.getElementById("userSearchResults");

    if (users.length === 0) {
      searchResults.innerHTML =
        '<div class="search-result-item text-muted">No users found</div>';
      searchResults.style.display = "block";
      return;
    }

    searchResults.innerHTML = users
      .map(
        (user) => `
            <div class="search-result-item" data-user-id="${user._id}">
                <div class="user-name">${user.firstName} ${user.lastName}</div>
                <div class="user-details">@${user.username} • ${user.email}</div>
            </div>
        `
      )
      .join("");

    searchResults.style.display = "block";

    // Add click listeners to search results
    document.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-user-id");
        const user = this.allUsers.find((u) => u._id === userId);
        if (user) {
          this.selectUser(user);
        }
      });
    });
  }

  selectUser(user) {
    this.selectedUser = user;

    const selectedUserInfo = document.getElementById("selectedUserInfo");
    const noUserSelected = document.getElementById("noUserSelected");

    selectedUserInfo.innerHTML = `
            <div class="selected-user-info">
                <strong>${user.firstName} ${user.lastName}</strong>
                <div class="small">@${user.username} • ${user.email}</div>
                <div class="small text-muted">Joined: ${this.formatDate(
                  new Date(user.createdAt)
                )}</div>
            </div>
        `;

    selectedUserInfo.style.display = "block";
    noUserSelected.style.display = "none";

    // Hide search results
    document.getElementById("userSearchResults").style.display = "none";

    this.updatePromoteButtonState();
  }

  clearUserSelection() {
    this.selectedUser = null;

    document.getElementById("selectedUserInfo").style.display = "none";
    document.getElementById("noUserSelected").style.display = "block";
    document.getElementById("userSearchResults").style.display = "none";
    document.getElementById("userSearch").value = "";
    document.getElementById("clearUserSearch").style.display = "none";

    this.updatePromoteButtonState();
  }

  clearUserSearch() {
    document.getElementById("userSearch").value = "";
    document.getElementById("userSearchResults").style.display = "none";
    document.getElementById("clearUserSearch").style.display = "none";
  }

  updatePromoteButtonState() {
    const promoteBtn = document.getElementById("promoteUserBtn");
    if (promoteBtn) {
      promoteBtn.disabled = !this.selectedUser;
    }
  }

  showPromoteSecurityConfirmation() {
    if (!this.selectedUser) return;

    const role = document.getElementById("adminRole").value;
    const roleName =
      role === "admin" ? "Full Administrator" : "Assistant Administrator";

    this.currentAction = "promote";
    this.targetAdminId = this.selectedUser._id;

    document.getElementById("adminActionModalTitle").innerHTML =
      '<i class="fas fa-user-shield me-2"></i>Promote User to Admin';

    document.getElementById("adminActionDescription").innerHTML = `
            <div class="security-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Security Action Required</strong>
            </div>
            <p>You are about to promote the following user to <strong>${roleName}</strong>:</p>
            <div class="p-3 bg-light rounded">
                <strong>${this.selectedUser.firstName} ${this.selectedUser.lastName}</strong><br>
                <small class="text-muted">@${this.selectedUser.username} • ${this.selectedUser.email}</small>
            </div>
            <p class="mt-2"><strong>This action cannot be undone and will grant administrative privileges.</strong></p>
        `;

    this.showSecurityModal();
  }

  showChangeRoleSecurityConfirmation(adminId, adminName, newRole) {
    this.currentAction = "change_role";
    this.targetAdminId = adminId;

    const roleName =
      newRole === "admin" ? "Full Administrator" : "Assistant Administrator";

    document.getElementById("adminActionModalTitle").innerHTML =
      '<i class="fas fa-user-cog me-2"></i>Change Admin Role';

    document.getElementById("adminActionDescription").innerHTML = `
            <div class="security-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Security Action Required</strong>
            </div>
            <p>You are about to change the role of the following admin to <strong>${roleName}</strong>:</p>
            <div class="p-3 bg-light rounded">
                <strong>${adminName}</strong>
            </div>
            <p class="mt-2"><strong>This will modify their system access privileges.</strong></p>
        `;

    this.showSecurityModal();
  }

  showRevokeSecurityConfirmation(adminId, adminName) {
    this.currentAction = "revoke";
    this.targetAdminId = adminId;

    document.getElementById("adminActionModalTitle").innerHTML =
      '<i class="fas fa-user-times me-2"></i>Revoke Admin Privileges';

    document.getElementById("adminActionDescription").innerHTML = `
            <div class="security-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Security Action Required</strong>
            </div>
            <p>You are about to <strong class="text-danger">revoke admin privileges</strong> for:</p>
            <div class="p-3 bg-light rounded">
                <strong>${adminName}</strong>
            </div>
            <p class="mt-2 text-danger"><strong>Warning: This action cannot be undone and will remove all administrative access.</strong></p>
        `;

    this.showSecurityModal();
  }

  showSecurityModal() {
    // Reset security modal fields
    document.getElementById("adminActionPassword").value = "";
    document.getElementById("adminActionConfirmText").value = "";
    document.getElementById("adminActionError").style.display = "none";

    // Close admin management modal
    bootstrap.Modal.getInstance(
      document.getElementById("adminManagementModal")
    )?.hide();

    // Show security modal
    const modal = new bootstrap.Modal(
      document.getElementById("adminActionSecurityModal")
    );
    modal.show();
  }

  async handleAdminActionConfirmation() {
    const adminPassword = document.getElementById("adminActionPassword").value;
    const confirmText = document.getElementById("adminActionConfirmText").value;
    const errorElement = document.getElementById("adminActionError");

    // Validation
    if (!adminPassword) {
      errorElement.textContent = "Please enter your admin password";
      errorElement.style.display = "block";
      return;
    }

    if (confirmText !== "CONFIRM") {
      errorElement.textContent =
        'Please type "CONFIRM" to proceed with this action';
      errorElement.style.display = "block";
      return;
    }

    errorElement.style.display = "none";
    this.showLoading(true);

    try {
      let response;
      let result;

      switch (this.currentAction) {
        case "promote":
          const role = document.getElementById("adminRole").value;
          response = await fetch("/api/accounts/admin/promote", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.adminToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: this.targetAdminId,
              role: role,
              adminPassword: adminPassword,
              confirmText: confirmText,
            }),
          });
          result = await response.json();

          if (result.success) {
            this.showAlert("User promoted to admin successfully!", "success");
            bootstrap.Modal.getInstance(
              document.getElementById("adminActionSecurityModal")
            )?.hide();
            await this.openAdminManagementModal(); // Reload the modal
          } else {
            throw new Error(result.message);
          }
          break;

        case "change_role":
          const newRole = document.getElementById("adminRole").value;
          response = await fetch("/api/accounts/admin/change-role", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.adminToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              adminId: this.targetAdminId,
              role: newRole,
              adminPassword: adminPassword,
              confirmText: confirmText,
            }),
          });
          result = await response.json();

          if (result.success) {
            this.showAlert("Admin role updated successfully!", "success");
            bootstrap.Modal.getInstance(
              document.getElementById("adminActionSecurityModal")
            )?.hide();
            await this.openAdminManagementModal(); // Reload the modal
          } else {
            throw new Error(result.message);
          }
          break;

        case "revoke":
          response = await fetch("/api/accounts/admin/revoke", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.adminToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              adminId: this.targetAdminId,
              adminPassword: adminPassword,
              confirmText: confirmText,
            }),
          });
          result = await response.json();

          if (result.success) {
            this.showAlert("Admin privileges revoked successfully!", "success");
            bootstrap.Modal.getInstance(
              document.getElementById("adminActionSecurityModal")
            )?.hide();
            await this.openAdminManagementModal(); // Reload the modal
          } else {
            throw new Error(result.message);
          }
          break;

        default:
          throw new Error("Unknown action");
      }
    } catch (error) {
      console.error(`Error performing ${this.currentAction}:`, error);
      errorElement.textContent = error.message;
      errorElement.style.display = "block";
    } finally {
      this.showLoading(false);
      this.currentAction = null;
      this.targetAdminId = null;
    }
  }

  formatDate(date) {
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  showLoading(show) {
    if (window.adminCommon && window.adminCommon.showLoading) {
      window.adminCommon.showLoading(show);
    } else {
      const loadingOverlay = document.getElementById("loadingOverlay");
      if (loadingOverlay) {
        loadingOverlay.style.display = show ? "flex" : "none";
      }
    }
  }

  showAlert(message, type) {
    if (window.adminCommon && window.adminCommon.showAlert) {
      window.adminCommon.showAlert(message, type);
    } else {
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
  }
}

// Initialize Admin Manager when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  const adminToken = localStorage.getItem("adminToken");
  const currentAdmin = localStorage.getItem("currentAdmin");

  // Check if admin is authenticated
  if (!adminToken || !currentAdmin) {
    window.location.href = "/admin/login";
    return;
  }

  // Initialize Admin Manager
  window.adminManager = new AdminManager();
});
