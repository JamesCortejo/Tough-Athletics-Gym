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
  let isAssistantAdmin = false;
  let currentStatusFilter = "active"; // Default filter
  let editModal = null;

  // TSOP Edit Session Tracking (for logging only, not for locking)
  let currentEditSessionId = null;
  let editSessionCheckInterval = null;

  // Initialize the page
  initializePage();

  // TSOP Functions (for logging only)
  function initializeTSOPLogging() {
    // Clean up on page unload
    window.addEventListener("beforeunload", cleanupEditSessions);
  }

  function cleanupEditSessions() {
    if (currentEditSessionId) {
      endEditSession(currentEditSessionId);
    }
    if (editSessionCheckInterval) {
      clearInterval(editSessionCheckInterval);
    }
  }

  async function startEditSession(userId, userData) {
    // Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to edit user accounts.",
        "warning"
      );
      return null;
    }

    const sessionData = {
      sessionId: generateSessionId(),
      userId: userId,
      adminId: JSON.parse(localStorage.getItem("currentAdmin"))._id,
      adminName: JSON.parse(localStorage.getItem("currentAdmin")).username,
      userName: `${userData.firstName} ${userData.lastName}`,
      startTime: new Date(),
      timestamp: Date.now(),
    };

    try {
      const response = await fetch("/api/accounts/admin/edit-sessions/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionData),
      });

      const result = await response.json();

      if (result.success) {
        currentEditSessionId = sessionData.sessionId;
        return sessionData.sessionId;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error starting edit session:", error);
      // Don't show alert for logging errors - continue with edit anyway
      return null;
    }
  }

  async function endEditSession(sessionId) {
    if (!sessionId) return;

    try {
      await fetch("/api/accounts/admin/edit-sessions/end", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      if (currentEditSessionId === sessionId) {
        currentEditSessionId = null;
      }
    } catch (error) {
      console.error("Error ending edit session:", error);
    }
  }

  function generateSessionId() {
    return `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if current admin is an assistant
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

  // Disable account management actions for assistant admins
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
    const pageHeader = document.querySelector(".dashboard-header");
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

  // Status filter functionality
  document.querySelectorAll(".status-filter-option").forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const status = this.getAttribute("data-status");
      handleStatusFilterChange(status);
    });
  });

  async function initializePage() {
    checkAdminRole();
    initializeTSOPLogging(); // Initialize TSOP logging

    // Initialize modal instance
    editModal = new bootstrap.Modal(
      document.getElementById("editAccountModal")
    );

    // Add event listener for modal close to end edit session
    document
      .getElementById("editAccountModal")
      ?.addEventListener("hide.bs.modal", function () {
        if (currentEditSessionId && !currentAction) {
          console.log(
            "Edit modal closed without saving - ending session:",
            currentEditSessionId
          );
          endEditSession(currentEditSessionId);
          currentEditSessionId = null;
        }
      });

    // Handle cancel button click
    document
      .querySelector("#editAccountModal .btn-secondary")
      ?.addEventListener("click", function () {
        console.log(
          "Cancel button clicked - ending session:",
          currentEditSessionId
        );
        if (currentEditSessionId) {
          endEditSession(currentEditSessionId);
          currentEditSessionId = null;
        }
      });

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

  function filterUsersByStatus(users, status) {
    if (status === "active") {
      return users.filter((user) => !user.isArchived);
    } else if (status === "archived") {
      return users.filter((user) => user.isArchived);
    }
    return users; // Return all if status is not recognized
  }

  function filterUsers(searchTerm) {
    if (!searchTerm.trim()) {
      // If no search term, just apply status filter to all users
      filteredUsers = filterUsersByStatus(allUsers, currentStatusFilter);
      displayUsers(filteredUsers);
      updateSearchUI(false);
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    // First filter by search term
    let searchFilteredUsers = allUsers.filter((user) => {
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

    // Then apply status filter
    filteredUsers = filterUsersByStatus(
      searchFilteredUsers,
      currentStatusFilter
    );
    displayUsers(filteredUsers);
    updateSearchUI(true);
  }

  function handleStatusFilterChange(status) {
    currentStatusFilter = status;

    // Update the dropdown text
    const statusFilterText = document.getElementById("statusFilterText");
    if (statusFilterText) {
      statusFilterText.textContent =
        status === "active" ? "Active Accounts" : "Archived Accounts";
    }

    // Update active class in dropdown items
    document.querySelectorAll(".status-filter-option").forEach((item) => {
      if (item.getAttribute("data-status") === status) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Apply the filter
    filterUsers(document.getElementById("usersSearch").value);
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

    // Reset to current status filter
    filteredUsers = filterUsersByStatus(allUsers, currentStatusFilter);
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

        // Apply the current status filter
        filteredUsers = filterUsersByStatus(allUsers, currentStatusFilter);

        // Update admin role from response if available
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
    const noUsersSearchResults = document.getElementById(
      "noUsersSearchResults"
    );
    const usersCount = document.getElementById("usersCount");

    // Update users count - show filtered count and total in parenthesis
    const totalUsers = allUsers.length;
    const filteredCount = users.length;
    usersCount.textContent = `${filteredCount} ${
      currentStatusFilter === "active" ? "active" : "archived"
    } user${filteredCount !== 1 ? "s" : ""} (${totalUsers} total)`;

    if (users.length === 0) {
      tableBody.innerHTML = "";

      // Show appropriate empty state message
      if (allUsers.length === 0) {
        // No users at all in the system
        noUsersMessage.style.display = "block";
        noUsersSearchResults.style.display = "none";
      } else if (
        filteredUsers.length === 0 &&
        document.getElementById("usersSearch").value.trim()
      ) {
        // Search returned no results
        noUsersMessage.style.display = "none";
        noUsersSearchResults.style.display = "block";
      } else {
        // Status filter returned no results
        noUsersMessage.style.display = "none";
        noUsersSearchResults.style.display = "block";

        // Update the no results message for status filter
        const noResultsElement = document.getElementById(
          "noUsersSearchResults"
        );
        if (noResultsElement) {
          noResultsElement.innerHTML = `
            <i class="fas fa-${
              currentStatusFilter === "active" ? "user-check" : "archive"
            } fa-3x mb-3"></i>
            <h4>No ${
              currentStatusFilter === "active" ? "Active" : "Archived"
            } Users</h4>
            <p class="text-muted">There are no ${
              currentStatusFilter === "active" ? "active" : "archived"
            } user accounts.</p>
          `;
        }
      }
      return;
    }

    noUsersMessage.style.display = "none";
    noUsersSearchResults.style.display = "none";

    tableBody.innerHTML = users
      .map((user) => {
        const joinDate = user.createdAt
          ? formatDate(new Date(user.createdAt))
          : "Unknown";
        const authMethod = user.authMethod
          ? user.authMethod.charAt(0).toUpperCase() + user.authMethod.slice(1)
          : "Local";
        const isArchived = user.isArchived || false;

        // Conditionally show action buttons based on admin role
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
    // Check if assistant admin
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
        // Update admin role from response if available
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

        // Reset current action when starting new edit
        currentAction = null;

        // Start TSOP edit session for logging
        const sessionId = await startEditSession(userId, result.user);

        // Display edit modal with user data
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
    if (editModal) {
      editModal.show();
    }
  }

  function showSecurityConfirmationForEdit() {
    // Check if assistant admin
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

    // Get the commit timestamp (when user clicks save)
    const commitTimestamp = Date.now();

    // Store in form data for later use
    editFormData.commitTimestamp = commitTimestamp;

    showSecurityConfirmationModal(
      "Edit User Account",
      `You are about to edit the account of <strong>${editFormData.firstName} ${editFormData.lastName}</strong>. 
       <br><br>
       <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          <strong>TSOP Concurrency Control:</strong> Multiple admins can edit simultaneously. 
          The last admin to save will overwrite previous changes.
       </div>`
    );
  }

  function showSecurityConfirmationForArchive() {
    // Check if assistant admin
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
    // Check if assistant admin
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
    // Final check for assistant admin
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
    if (editModal && currentAction !== "edit") {
      editModal.hide();
    }
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
    // Final check for assistant admin
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
                commitTimestamp: editFormData.commitTimestamp, // Send commit timestamp
                editSessionId: currentEditSessionId, // Include session ID for logging
              }),
            }
          );
          result = await response.json();

          if (result.success) {
            let alertMessage = "User account updated successfully!";

            // Show conflict warning if applicable
            if (result.hadConflict) {
              alertMessage +=
                " (Note: Your changes overwrote a more recent update)";
              showAlert(alertMessage, "warning");
            } else {
              showAlert(alertMessage, "success");
            }

            bootstrap.Modal.getInstance(
              document.getElementById("securityConfirmModal")
            ).hide();

            // Close edit modal
            if (editModal) {
              editModal.hide();
            }

            // End the edit session after successful update
            if (currentEditSessionId) {
              await endEditSession(currentEditSessionId);
              currentEditSessionId = null;
            }

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
    // Check if assistant admin
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
    // Check if assistant admin
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

    // Update statistics - show actual numbers even if 0
    document.getElementById("totalUsers").textContent = users.length;
    document.getElementById("activeUsers").textContent = activeUsers.length;
    document.getElementById("archivedUsers").textContent = archivedUsers.length;
    document.getElementById("newUsersThisWeek").textContent =
      newUsersThisWeek.length;
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
