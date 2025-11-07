// adminAccountManager.js
document.addEventListener("DOMContentLoaded", function () {
  const adminToken = localStorage.getItem("adminToken");
  const currentAdmin = localStorage.getItem("currentAdmin");

  // Check if admin is authenticated
  if (!adminToken || !currentAdmin) {
    window.location.href = "/admin/login";
    return;
  }

  let allUsers = [];
  let filteredUsers = [];
  let currentUserId = null;
  let currentAction = null; // 'edit', 'archive', 'unarchive'
  let searchTimeout = null;
  let editFormData = null;
  let isAssistantAdmin = false; // NEW: Track admin role

  // Initialize the page
  initializePage();

  // NEW: Check if current admin is an assistant
  function checkAdminRole() {
    try {
      const adminData = JSON.parse(currentAdmin || "{}");
      isAssistantAdmin = adminData.isAssistant === true;

      if (isAssistantAdmin) {
        console.log(
          "🔒 Assistant admin detected - restricting account actions"
        );
        disableAccountActions();
      }
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  }

  // NEW: Disable account management actions for assistant admins
  function disableAccountActions() {
    // Hide action buttons in the table
    const actionButtons = document.querySelectorAll(`
      .edit-account-btn,
      .archive-account-btn,
      .unarchive-account-btn
    `);

    actionButtons.forEach((button) => {
      button.style.display = "none";
    });

    // Hide the save button in edit modal
    const saveButton = document.getElementById("saveAccountBtn");
    if (saveButton) {
      saveButton.style.display = "none";
    }

    // Add assistant restriction notice to the table
    const tableHead = document.querySelector("#usersTable thead tr");
    if (tableHead) {
      const actionHeader = tableHead.querySelector("th:last-child");
      if (actionHeader) {
        actionHeader.innerHTML = `
          <span class="text-muted">
            <i class="fas fa-info-circle"></i>
            Assistant Admin
          </span>
        `;
      }
    }

    // Add restriction notice to the page
    const pageHeader = document.querySelector(".page-header");
    if (pageHeader && !document.getElementById("assistantRestrictionNotice")) {
      const restrictionNotice = document.createElement("div");
      restrictionNotice.id = "assistantRestrictionNotice";
      restrictionNotice.className = "alert alert-info mt-3";
      restrictionNotice.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <strong>Assistant Admin:</strong> You have view-only access. Account modifications are restricted to full administrators.
      `;
      pageHeader.parentNode.insertBefore(
        restrictionNotice,
        pageHeader.nextSibling
      );
    }
  }

  // Event Listeners
  document
    .getElementById("refreshAccountsBtn")
    .addEventListener("click", loadUsers);
  document
    .getElementById("saveAccountBtn")
    .addEventListener("click", showSecurityConfirmationForEdit);
  document
    .getElementById("confirmArchiveBtn")
    .addEventListener("click", showSecurityConfirmationForArchive);
  document
    .getElementById("confirmUnarchiveBtn")
    .addEventListener("click", showSecurityConfirmationForUnarchive);
  document
    .getElementById("confirmSecurityBtn")
    .addEventListener("click", handleSecurityConfirmation);

  // Search functionality
  const searchInput = document.getElementById("usersSearch");
  const clearSearchBtn = document.getElementById("clearUsersSearch");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleUsersSearch(e.target.value);
    });

    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleUsersSearch(e.target.value);
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", clearUsersSearch);
  }

  async function initializePage() {
    checkAdminRole(); // NEW: Check admin role on init
    await loadUsers();
  }

  function handleUsersSearch(searchTerm) {
    const clearSearchBtn = document.getElementById("clearUsersSearch");

    // Show/hide clear button
    if (searchTerm.trim() && clearSearchBtn) {
      clearSearchBtn.style.display = "flex";
    } else if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterUsers(searchTerm);
    }, 300);
  }

  function filterUsers(searchTerm) {
    if (!searchTerm.trim()) {
      filteredUsers = [...allUsers];
      displayUsers(filteredUsers);
      updateSearchUI(false);
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    filteredUsers = allUsers.filter((user) => {
      const searchableFields = [
        user.firstName,
        user.lastName,
        user.email,
        user.username,
        user.mobile,
        user.authMethod,
      ]
        .filter((field) => field)
        .map((field) => field.toLowerCase());

      return searchableFields.some((field) => field.includes(term));
    });

    displayUsers(filteredUsers);
    updateSearchUI(true);
  }

  function clearUsersSearch() {
    const searchInput = document.getElementById("usersSearch");
    const clearSearchBtn = document.getElementById("clearUsersSearch");

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    filteredUsers = [...allUsers];
    displayUsers(filteredUsers);
    updateSearchUI(false);
  }

  function updateSearchUI(isSearching) {
    const noResultsElement = document.getElementById("noUsersSearchResults");
    const noUsersElement = document.getElementById("noUsersMessage");

    if (noResultsElement && noUsersElement) {
      if (isSearching && filteredUsers.length === 0) {
        noResultsElement.style.display = "block";
        noUsersElement.style.display = "none";
      } else {
        noResultsElement.style.display = "none";
        if (allUsers.length === 0) {
          noUsersElement.style.display = "block";
        } else {
          noUsersElement.style.display = "none";
        }
      }
    }
  }

  async function loadUsers() {
    showLoading(true);

    try {
      const response = await fetch("/api/accounts/admin/accounts", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        allUsers = result.users;
        filteredUsers = [...allUsers];

        // NEW: Update admin role from response if available
        if (result.adminRole === "assistant") {
          isAssistantAdmin = true;
          disableAccountActions();
        }

        displayUsers(filteredUsers);
        updateStatistics(allUsers);
        clearUsersSearch(); // Reset search when reloading
      } else {
        showAlert("Failed to load users: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error loading users:", error);
      showAlert("Error loading users. Please try again.", "danger");
      // Display empty state
      allUsers = [];
      filteredUsers = [];
      displayUsers([]);
      updateStatistics([]);
    } finally {
      showLoading(false);
    }
  }

  function displayUsers(users) {
    const tableBody = document.getElementById("usersTableBody");
    const noUsersMessage = document.getElementById("noUsersMessage");
    const usersCount = document.getElementById("usersCount");

    // Update users count
    usersCount.textContent = `${allUsers.length} user${
      allUsers.length !== 1 ? "s" : ""
    }`;

    if (users.length === 0) {
      tableBody.innerHTML = "";
      if (users === filteredUsers && allUsers.length > 0) {
        // This means we have users but search returned no results
        noUsersMessage.style.display = "none";
      } else {
        noUsersMessage.style.display = "block";
      }
      return;
    }

    noUsersMessage.style.display = "none";

    tableBody.innerHTML = users
      .map((user) => {
        const joinDate = user.createdAt
          ? formatDate(new Date(user.createdAt))
          : "Unknown";
        const authMethod = user.authMethod
          ? user.authMethod.charAt(0).toUpperCase() + user.authMethod.slice(1)
          : "Local";
        const isArchived = user.isArchived || false;

        // NEW: Conditionally show action buttons based on admin role
        const actionButtons = isAssistantAdmin
          ? `<span class="text-muted small">View only</span>`
          : `
          <div class="btn-group" role="group">
              <button class="btn btn-primary btn-sm btn-action edit-account-btn" 
                      data-user-id="${user._id}">
                  <i class="fas fa-edit"></i> Edit
              </button>
              ${
                isArchived
                  ? `<button class="btn btn-success btn-sm btn-action unarchive-account-btn" 
                        data-user-id="${user._id}">
                    <i class="fas fa-undo"></i> Activate
                  </button>`
                  : `<button class="btn btn-warning btn-sm btn-action archive-account-btn" 
                        data-user-id="${user._id}">
                    <i class="fas fa-archive"></i> Archive
                  </button>`
              }
          </div>
          `;

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${
                          user.profilePicture || "/images/default-profile.png"
                        }" 
                             alt="Profile" 
                             class="rounded-circle me-3"
                             style="width: 40px; height: 40px; object-fit: cover;">
                        <div>
                            <strong>${user.firstName} ${user.lastName}</strong>
                            <div class="small text-muted">@${
                              user.username
                            }</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${user.email}</div>
                    <div class="small text-muted">${
                      user.mobile || "No phone"
                    }</div>
                </td>
                <td>
                    <span class="badge ${getAuthMethodBadgeClass(authMethod)}">
                        ${authMethod}
                    </span>
                </td>
                <td>${joinDate}</td>
                <td>
                    ${
                      isArchived
                        ? '<span class="badge bg-danger">Archived</span>'
                        : '<span class="badge bg-success">Active</span>'
                    }
                </td>
                <td>
                    ${actionButtons}
                </td>
            </tr>
        `;
      })
      .join("");

    // Add event listeners to action buttons (only if not assistant admin)
    if (!isAssistantAdmin) {
      document.querySelectorAll(".edit-account-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          const userId = this.getAttribute("data-user-id");
          showEditAccountModal(userId);
        });
      });

      document.querySelectorAll(".archive-account-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          const userId = this.getAttribute("data-user-id");
          showArchiveConfirmation(userId);
        });
      });

      document.querySelectorAll(".unarchive-account-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          const userId = this.getAttribute("data-user-id");
          showUnarchiveConfirmation(userId);
        });
      });
    }
  }

  function getAuthMethodBadgeClass(authMethod) {
    switch (authMethod.toLowerCase()) {
      case "google":
        return "bg-danger";
      case "facebook":
        return "bg-primary";
      case "local":
        return "bg-secondary";
      default:
        return "bg-dark";
    }
  }

  async function showEditAccountModal(userId) {
    // NEW: Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to edit user accounts.",
        "warning"
      );
      return;
    }

    showLoading(true);

    try {
      const response = await fetch(`/api/accounts/admin/accounts/${userId}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // NEW: Update admin role from response if available
        if (result.adminRole === "assistant") {
          isAssistantAdmin = true;
          disableAccountActions();
          showLoading(false);
          showAlert(
            "Assistant admins are not authorized to edit user accounts.",
            "warning"
          );
          return;
        }

        displayEditAccountModal(result.user);
        currentUserId = userId;
      } else {
        showAlert("Failed to load user details: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error loading user details:", error);
      showAlert("Error loading user details.", "danger");
    } finally {
      showLoading(false);
    }
  }

  function displayEditAccountModal(user) {
    if (!user) {
      showAlert("No user data found", "danger");
      return;
    }

    // Set form values
    document.getElementById("editFirstName").value = user.firstName || "";
    document.getElementById("editLastName").value = user.lastName || "";
    document.getElementById("editUsername").value = user.username || "";
    document.getElementById("editEmail").value = user.email || "";
    document.getElementById("editMobile").value = user.mobile || "";
    document.getElementById("editGender").value = user.gender || "";
    document.getElementById("editAge").value = user.age || "";
    document.getElementById("editAuthMethod").value = user.authMethod
      ? user.authMethod.charAt(0).toUpperCase() + user.authMethod.slice(1)
      : "Local";

    // Set account status badge
    const statusBadge = document.getElementById("accountStatusBadge");
    if (user.isArchived) {
      statusBadge.className = "badge bg-danger";
      statusBadge.textContent = "Archived";
    } else {
      statusBadge.className = "badge bg-success";
      statusBadge.textContent = "Active";
    }

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("editAccountModal")
    );
    modal.show();
  }

  function showSecurityConfirmationForEdit() {
    // NEW: Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to edit user accounts.",
        "warning"
      );
      return;
    }

    if (!currentUserId) return;

    // Collect form data
    editFormData = {
      firstName: document.getElementById("editFirstName").value.trim(),
      lastName: document.getElementById("editLastName").value.trim(),
      username: document.getElementById("editUsername").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
      mobile: document.getElementById("editMobile").value.trim(),
      gender: document.getElementById("editGender").value,
      age: document.getElementById("editAge").value
        ? parseInt(document.getElementById("editAge").value)
        : null,
    };

    // Basic validation
    if (
      !editFormData.firstName ||
      !editFormData.lastName ||
      !editFormData.username ||
      !editFormData.email
    ) {
      showAlert("Please fill in all required fields", "warning");
      return;
    }

    currentAction = "edit";
    showSecurityConfirmationModal(
      "Edit User Account",
      `You are about to edit the account of <strong>${editFormData.firstName} ${editFormData.lastName}</strong>. This action requires security confirmation.`
    );
  }

  function showSecurityConfirmationForArchive() {
    // NEW: Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to archive user accounts.",
        "warning"
      );
      return;
    }

    if (!currentUserId) return;

    const user = allUsers.find((u) => u._id === currentUserId);
    if (!user) return;

    currentAction = "archive";
    showSecurityConfirmationModal(
      "Archive User Account",
      `You are about to archive the account of <strong>${user.firstName} ${user.lastName}</strong>. This action will prevent the user from logging in.`
    );
  }

  function showSecurityConfirmationForUnarchive() {
    // NEW: Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to activate user accounts.",
        "warning"
      );
      return;
    }

    if (!currentUserId) return;

    const user = allUsers.find((u) => u._id === currentUserId);
    if (!user) return;

    currentAction = "unarchive";
    showSecurityConfirmationModal(
      "Activate User Account",
      `You are about to activate the account of <strong>${user.firstName} ${user.lastName}</strong>. This will allow the user to log in again.`
    );
  }

  function showSecurityConfirmationModal(title, description) {
    // NEW: Final check for assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to perform account modifications.",
        "warning"
      );
      return;
    }

    // Reset security modal fields
    document.getElementById("adminPassword").value = "";
    document.getElementById("confirmText").value = "";
    document.getElementById("securityError").style.display = "none";

    // Set modal content
    document.getElementById("securityModalTitle").textContent = title;
    document.getElementById("securityActionDescription").innerHTML =
      description;

    // Close other modals and show security modal
    bootstrap.Modal.getInstance(
      document.getElementById("editAccountModal")
    )?.hide();
    bootstrap.Modal.getInstance(
      document.getElementById("archiveConfirmModal")
    )?.hide();
    bootstrap.Modal.getInstance(
      document.getElementById("unarchiveConfirmModal")
    )?.hide();

    const modal = new bootstrap.Modal(
      document.getElementById("securityConfirmModal")
    );
    modal.show();
  }

  async function handleSecurityConfirmation() {
    // NEW: Final check for assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to perform account modifications.",
        "warning"
      );

      // Close the security modal
      const securityModal = bootstrap.Modal.getInstance(
        document.getElementById("securityConfirmModal")
      );
      if (securityModal) {
        securityModal.hide();
      }
      return;
    }

    const adminPassword = document.getElementById("adminPassword").value;
    const confirmText = document.getElementById("confirmText").value;
    const securityError = document.getElementById("securityError");

    // Validation
    if (!adminPassword) {
      securityError.textContent = "Please enter your admin password";
      securityError.style.display = "block";
      return;
    }

    if (confirmText !== "CONFIRM") {
      securityError.textContent =
        'Please type "CONFIRM" to proceed with this action';
      securityError.style.display = "block";
      return;
    }

    securityError.style.display = "none";
    showLoading(true);

    try {
      let response;
      let result;

      switch (currentAction) {
        case "edit":
          response = await fetch(
            `/api/accounts/admin/accounts/${currentUserId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                updateData: editFormData,
                adminPassword: adminPassword,
                confirmText: confirmText,
              }),
            }
          );
          result = await response.json();

          if (result.success) {
            showAlert("User account updated successfully!", "success");
            bootstrap.Modal.getInstance(
              document.getElementById("securityConfirmModal")
            ).hide();
            await loadUsers();
          } else {
            throw new Error(result.message);
          }
          break;

        case "archive":
          response = await fetch(
            `/api/accounts/admin/accounts/${currentUserId}/archive`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                adminPassword: adminPassword,
                confirmText: confirmText,
              }),
            }
          );
          result = await response.json();

          if (result.success) {
            showAlert("User account archived successfully!", "success");
            bootstrap.Modal.getInstance(
              document.getElementById("securityConfirmModal")
            ).hide();
            await loadUsers();
          } else {
            throw new Error(result.message);
          }
          break;

        case "unarchive":
          response = await fetch(
            `/api/accounts/admin/accounts/${currentUserId}/unarchive`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${adminToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                adminPassword: adminPassword,
                confirmText: confirmText,
              }),
            }
          );
          result = await response.json();

          if (result.success) {
            showAlert("User account activated successfully!", "success");
            bootstrap.Modal.getInstance(
              document.getElementById("securityConfirmModal")
            ).hide();
            await loadUsers();
          } else {
            throw new Error(result.message);
          }
          break;

        default:
          throw new Error("Unknown action");
      }
    } catch (error) {
      console.error(`Error performing ${currentAction}:`, error);
      securityError.textContent = error.message;
      securityError.style.display = "block";
    } finally {
      showLoading(false);
      currentAction = null;
      currentUserId = null;
      editFormData = null;
    }
  }

  function showArchiveConfirmation(userId) {
    // NEW: Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to archive user accounts.",
        "warning"
      );
      return;
    }

    const user = allUsers.find((u) => u._id === userId);
    if (!user) return;

    currentUserId = userId;

    const archiveDescription = document.getElementById("archiveDescription");
    archiveDescription.innerHTML = `
        <p>Are you sure you want to archive the following user account?</p>
        <div class="user-info p-3 bg-light rounded">
            <strong>${user.firstName} ${user.lastName}</strong><br>
            <small class="text-muted">@${user.username} • ${user.email}</small>
        </div>
    `;

    const modal = new bootstrap.Modal(
      document.getElementById("archiveConfirmModal")
    );
    modal.show();
  }

  function showUnarchiveConfirmation(userId) {
    // NEW: Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to activate user accounts.",
        "warning"
      );
      return;
    }

    const user = allUsers.find((u) => u._id === userId);
    if (!user) return;

    currentUserId = userId;

    const unarchiveDescription = document.getElementById(
      "unarchiveDescription"
    );
    unarchiveDescription.innerHTML = `
        <p>Are you sure you want to activate this user account?</p>
        <div class="user-info p-3 bg-light rounded">
            <strong>${user.firstName} ${user.lastName}</strong><br>
            <small class="text-muted">@${user.username} • ${user.email}</small>
        </div>
    `;

    const modal = new bootstrap.Modal(
      document.getElementById("unarchiveConfirmModal")
    );
    modal.show();
  }

  // ... rest of the existing functions (updateStatistics, formatDate, showLoading, showAlert) remain the same ...
  function updateStatistics(users) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const activeUsers = users.filter((user) => !user.isArchived);
    const archivedUsers = users.filter((user) => user.isArchived);
    const newUsersThisWeek = users.filter(
      (user) => user.createdAt && new Date(user.createdAt) >= startOfWeek
    );

    // Update statistics
    document.getElementById("totalUsers").textContent =
      users.length > 0 ? users.length : "-";
    document.getElementById("activeUsers").textContent =
      activeUsers.length > 0 ? activeUsers.length : "-";
    document.getElementById("archivedUsers").textContent =
      archivedUsers.length > 0 ? archivedUsers.length : "-";
    document.getElementById("newUsersThisWeek").textContent =
      newUsersThisWeek.length > 0 ? newUsersThisWeek.length : "-";
  }

  function formatDate(date) {
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function showLoading(show) {
    if (window.adminCommon && window.adminCommon.showLoading) {
      window.adminCommon.showLoading(show);
    } else {
      const loadingOverlay = document.getElementById("loadingOverlay");
      if (loadingOverlay) {
        loadingOverlay.style.display = show ? "flex" : "none";
      }
    }
  }

  function showAlert(message, type) {
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
});
