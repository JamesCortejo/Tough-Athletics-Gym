// adminReports.js
document.addEventListener("DOMContentLoaded", function () {
  const adminToken = localStorage.getItem("adminToken");
  const currentAdmin = localStorage.getItem("currentAdmin");

  // Check if admin is authenticated
  if (!adminToken || !currentAdmin) {
    window.location.href = "/admin/login";
    return;
  }

  let currentAdminActions = [];
  let currentUserActions = [];
  let allAdmins = [];
  let allUsers = [];
  let isAssistantAdmin = false;
  let currentDownloadType = null;
  let currentDownloadPeriod = null;

  // Initialize the page
  initializePage();

  // Check if current admin is an assistant
  function checkAdminRole() {
    try {
      const adminData = JSON.parse(currentAdmin || "{}");
      isAssistantAdmin = adminData.isAssistant === true;

      if (isAssistantAdmin) {
        console.log(
          "🔒 Assistant admin detected - restricting report downloads"
        );
        disableReportDownloads();
      }
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  }

  // Disable report downloads for assistant admins
  function disableReportDownloads() {
    const downloadButtons = document.querySelectorAll(`
      #downloadRevenueReport,
      #downloadMembershipReport,
      #downloadCheckinReport
    `);

    downloadButtons.forEach((button) => {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-ban me-1"></i>Assistant Restricted';
      button.title = "Report downloads are restricted to full administrators";

      // Add tooltip
      button.setAttribute("data-bs-toggle", "tooltip");
      button.setAttribute("data-bs-placement", "top");
      button.setAttribute(
        "data-bs-title",
        "Assistant admins cannot download reports"
      );
    });

    // Initialize tooltips
    if (typeof bootstrap !== "undefined" && bootstrap.Tooltip) {
      const tooltipTriggerList = [].slice.call(
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
      );
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      });
    }

    // Add restriction notice to the PDF reports section
    const pdfSection = document.querySelector(".pdf-reports-section");
    if (pdfSection && !document.getElementById("reportRestrictionNotice")) {
      const restrictionNotice = document.createElement("div");
      restrictionNotice.id = "reportRestrictionNotice";
      restrictionNotice.className = "alert alert-warning mt-3";
      restrictionNotice.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <strong>Assistant Admin Restriction:</strong> Report downloads are only available to full administrators. 
        You can view reports on screen but cannot download PDF files.
      `;
      pdfSection.querySelector(".card-body").appendChild(restrictionNotice);
    }
  }

  // Event Listeners
  document
    .getElementById("refreshAdminActions")
    .addEventListener("click", loadAdminActions);
  document
    .getElementById("refreshUserActions")
    .addEventListener("click", loadUserActions);

  // Filter change listeners
  document
    .getElementById("adminFilter")
    .addEventListener("change", loadAdminActions);
  document
    .getElementById("actionTypeFilter")
    .addEventListener("change", loadAdminActions);
  document
    .getElementById("sortOrderAdmin")
    .addEventListener("change", loadAdminActions);

  document
    .getElementById("userFilter")
    .addEventListener("change", loadUserActions);
  document
    .getElementById("userActionTypeFilter")
    .addEventListener("change", loadUserActions);
  document
    .getElementById("sortOrderUser")
    .addEventListener("change", loadUserActions);

  // PDF Download Event Listeners
  document
    .getElementById("downloadRevenueReport")
    .addEventListener("click", () => showDownloadConfirmation("revenue"));
  document
    .getElementById("downloadMembershipReport")
    .addEventListener("click", () => showDownloadConfirmation("membership"));
  document
    .getElementById("downloadCheckinReport")
    .addEventListener("click", () => showDownloadConfirmation("checkin"));

  // Security confirmation event listener
  document
    .getElementById("confirmDownloadBtn")
    .addEventListener("click", handleDownloadConfirmation);

  async function initializePage() {
    checkAdminRole();
    await Promise.all([loadAdminActions(), loadUserActions()]);
  }

  // Show download confirmation modal
  function showDownloadConfirmation(type) {
    // Check if assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to download reports. Please contact a full administrator.",
        "warning"
      );
      return;
    }

    const periodSelect = document.getElementById(`${type}Period`);
    const period = periodSelect ? periodSelect.value : "all";

    currentDownloadType = type;
    currentDownloadPeriod = period;

    // Set modal content
    const reportTitles = {
      revenue: "Revenue Report",
      membership: "Membership Report",
      checkin: "Check-in Report",
    };

    document.getElementById(
      "downloadModalLabel"
    ).textContent = `Download ${reportTitles[type]}`;

    document.getElementById("downloadActionDescription").innerHTML = `
    <p>You are about to download the <strong>${
      reportTitles[type]
    }</strong> for period: <strong>${getPeriodDisplay(period)}</strong>.</p>
    <p>This action requires security confirmation and will be recorded in the admin logs.</p>
  `;

    // Reset security modal fields
    document.getElementById("downloadAdminPassword").value = "";
    document.getElementById("downloadConfirmText").value = "";
    document.getElementById("downloadSecurityError").style.display = "none";

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("downloadConfirmModal")
    );
    modal.show();
  }

  // Handle download confirmation with security checks
  async function handleDownloadConfirmation() {
    // Final check for assistant admin
    if (isAssistantAdmin) {
      showAlert(
        "Assistant admins are not authorized to download reports.",
        "warning"
      );

      // Close the modal
      const downloadModal = bootstrap.Modal.getInstance(
        document.getElementById("downloadConfirmModal")
      );
      if (downloadModal) {
        downloadModal.hide();
      }
      return;
    }

    const adminPassword = document.getElementById(
      "downloadAdminPassword"
    ).value;
    const confirmText = document.getElementById("downloadConfirmText").value;
    const securityError = document.getElementById("downloadSecurityError");

    // Validation
    if (!adminPassword) {
      securityError.textContent = "Please enter your admin password";
      securityError.style.display = "block";
      return;
    }

    if (confirmText !== "CONFIRM") {
      securityError.textContent =
        'Please type "CONFIRM" to proceed with this download';
      securityError.style.display = "block";
      return;
    }

    securityError.style.display = "none";
    showLoading(true);

    try {
      // Use fetch with security credentials
      const response = await fetch(
        `/api/reports/${currentDownloadType}-pdf?period=${currentDownloadPeriod}`,
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

      if (response.status === 403) {
        throw new Error(
          "Access denied. Assistant admins cannot download reports."
        );
      }

      if (response.status === 401) {
        throw new Error("Authentication failed. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.status} ${response.statusText}`
        );
      }

      // Get the blob data
      const blob = await response.blob();

      // Check if blob is valid
      if (blob.size === 0) {
        throw new Error("Generated PDF is empty");
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Get filename from header or generate default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `${currentDownloadType}-report-${currentDownloadPeriod}-${
        new Date().toISOString().split("T")[0]
      }.pdf`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up immediately
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Close modal
      bootstrap.Modal.getInstance(
        document.getElementById("downloadConfirmModal")
      ).hide();

      showAlert(
        `${
          currentDownloadType.charAt(0).toUpperCase() +
          currentDownloadType.slice(1)
        } report downloaded successfully!`,
        "success"
      );
    } catch (error) {
      console.error(`Error downloading ${currentDownloadType} report:`, error);
      securityError.textContent = error.message;
      securityError.style.display = "block";
    } finally {
      showLoading(false);
      currentDownloadType = null;
      currentDownloadPeriod = null;
    }
  }

  // Helper function to get period display
  function getPeriodDisplay(period) {
    const periods = {
      today: "Today",
      week: "Last 7 Days",
      month: "Last 30 Days",
      year: "Last Year",
      all: "All Time",
    };
    return periods[period] || "All Time";
  }

  async function loadAdminActions() {
    showLoading(true);

    try {
      const adminFilter = document.getElementById("adminFilter").value;
      const actionTypeFilter =
        document.getElementById("actionTypeFilter").value;
      const sortOrder = document.getElementById("sortOrderAdmin").value;

      const params = new URLSearchParams({
        adminId: adminFilter,
        actionType: actionTypeFilter,
        sortOrder: sortOrder,
      });

      console.log("Loading admin actions with params:", params.toString());

      const response = await fetch(`/api/reports/admin/actions?${params}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        currentAdminActions = result.actions;
        allAdmins = result.admins;
        console.log("Loaded admin actions:", currentAdminActions);
        console.log("Loaded admins:", allAdmins);
        displayAdminActions(currentAdminActions);
        populateAdminFilter(allAdmins);
      } else {
        showAlert("Failed to load admin actions: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error loading admin actions:", error);
      showAlert("Error loading admin actions. Please try again.", "danger");
      displayAdminActions([]);
    } finally {
      showLoading(false);
    }
  }

  async function loadUserActions() {
    showLoading(true);

    try {
      const userFilter = document.getElementById("userFilter").value;
      const actionTypeFilter = document.getElementById(
        "userActionTypeFilter"
      ).value;
      const sortOrder = document.getElementById("sortOrderUser").value;

      const params = new URLSearchParams({
        userId: userFilter,
        actionType: actionTypeFilter,
        sortOrder: sortOrder,
      });

      const response = await fetch(
        `/api/reports/admin/user-actions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        currentUserActions = result.actions;
        allUsers = result.users;
        displayUserActions(currentUserActions);
        populateUserFilter(allUsers);
      } else {
        showAlert("Failed to load user actions: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error loading user actions:", error);
      showAlert("Error loading user actions. Please try again.", "danger");
      displayUserActions([]);
    } finally {
      showLoading(false);
    }
  }

  function populateAdminFilter(admins) {
    const adminFilter = document.getElementById("adminFilter");
    const currentValue = adminFilter.value;

    adminFilter.innerHTML = '<option value="all">All Admins</option>';

    admins.forEach((admin) => {
      const option = document.createElement("option");
      option.value = admin._id;
      option.textContent = `${admin.firstName} ${admin.lastName} (${admin.username})`;
      adminFilter.appendChild(option);
    });

    if (currentValue && admins.some((admin) => admin._id === currentValue)) {
      adminFilter.value = currentValue;
    }

    console.log("Populated admin filter with", admins.length, "admins");
  }

  function populateUserFilter(users) {
    const userFilter = document.getElementById("userFilter");
    const currentValue = userFilter.value;

    userFilter.innerHTML = '<option value="all">All Users</option>';

    users.forEach((user) => {
      const option = document.createElement("option");
      option.value = user._id;
      option.textContent = `${user.firstName} ${user.lastName} (${user.username})`;
      userFilter.appendChild(option);
    });

    if (currentValue && users.some((user) => user._id === currentValue)) {
      userFilter.value = currentValue;
    }
  }

  function displayAdminActions(actions) {
    const output = document.getElementById("adminActionsOutput");
    const stats = document.getElementById("adminActionsStats");

    stats.textContent = `${actions.length} action${
      actions.length !== 1 ? "s" : ""
    }`;

    if (actions.length === 0) {
      output.innerHTML = `
        <div class="no-data">
          <i class="fas fa-search fa-3x mb-3"></i>
          <h4>No Admin Actions Found</h4>
          <p class="text-muted">No actions match your current filters.</p>
        </div>
      `;
      return;
    }

    output.innerHTML = actions
      .map((action) => {
        const timestamp = formatTimestamp(new Date(action.timestamp));
        const actionClass = getAdminActionClass(action.action);
        const message = formatAdminActionMessage(action);

        let adminDisplayName = action.adminName || "Unknown Admin";
        let adminId = action.adminId;

        if (adminId && typeof adminId === "object") {
          adminId = adminId.toString();
        }

        // Get user information for display
        const userInfo = getUserInfoForAction(action);

        return `
        <div class="command-line action-${actionClass}">
          <div class="command-timestamp">${timestamp}</div>
          <div class="command-message">${message}</div>
          <div class="command-meta">
            Admin: ${adminDisplayName} | 
            ${userInfo}
            Action: ${formatActionType(action.action)} |
            ID: ${action._id}
          </div>
        </div>
      `;
      })
      .join("");
  }

  function getUserInfoForAction(action) {
    // For membership actions
    if (action.memberName || action.memberFirstName) {
      const memberName =
        action.memberName ||
        `${action.memberFirstName} ${action.memberLastName}`;
      const memberEmail = action.memberEmail || "N/A";
      const qrCode = action.memberQrCodeId || action.qrCodeId || "N/A";
      return `Member: ${memberName} (${memberEmail}) | QR: ${qrCode} | `;
    }

    // For user account actions
    if (action.targetUserName || action.targetFirstName) {
      const targetName =
        action.targetUserName ||
        `${action.targetFirstName} ${action.targetLastName}`;
      const targetEmail = action.targetEmail || "N/A";
      const targetUsername = action.targetUsername || "N/A";
      return `User: ${targetName} (${targetUsername}) | Email: ${targetEmail} | `;
    }

    // For check-in actions
    if (action.action === "member_checkin" && action.qrCodeId) {
      return `QR Code: ${action.qrCodeId} | `;
    }

    return "";
  }

  function displayUserActions(actions) {
    const output = document.getElementById("userActionsOutput");
    const stats = document.getElementById("userActionsStats");

    stats.textContent = `${actions.length} action${
      actions.length !== 1 ? "s" : ""
    }`;

    if (actions.length === 0) {
      output.innerHTML = `
        <div class="no-data">
          <i class="fas fa-search fa-3x mb-3"></i>
          <h4>No User Actions Found</h4>
          <p class="text-muted">No actions match your current filters.</p>
        </div>
      `;
      return;
    }

    output.innerHTML = actions
      .map((action) => {
        const timestamp = formatTimestamp(new Date(action.timestamp));
        const actionClass = action.actionType;
        const message = formatUserActionMessage(action);
        const user = allUsers.find((u) => u._id === action.userId) || {};

        return `
        <div class="command-line action-${actionClass}">
          <div class="command-timestamp">${timestamp}</div>
          <div class="command-message">${message}</div>
          <div class="command-meta">
            User: ${user.firstName || "Unknown"} ${user.lastName || ""} (${
          user.username || "Unknown"
        }) | 
            Auth: ${action.authMethod || "Unknown"} |
            IP: ${action.ipAddress || "Unknown"} |
            QR: ${action.qrCodeId || "N/A"}
          </div>
        </div>
      `;
      })
      .join("");
  }

  function formatAdminActionMessage(action) {
    // Get user/member name for the message
    const userName =
      action.memberName ||
      action.targetUserName ||
      (action.memberFirstName && action.memberLastName
        ? `${action.memberFirstName} ${action.memberLastName}`
        : action.targetFirstName && action.targetLastName
        ? `${action.targetFirstName} ${action.targetLastName}`
        : "Unknown User");

    switch (action.action) {
      case "extend_membership":
        return `🔗 Extended membership for ${userName} by ${action.months} month(s). New end date: ${formatDate(new Date(action.newEndDate))}`;

      case "change_plan":
        return `🔄 Changed plan for ${userName} from ${action.oldPlan} to ${action.newPlan}. End date: ${formatDate(new Date(action.endDate))}`;

      case "withdraw_membership":
        const oldEndDate = action.oldEndDate
          ? formatDate(new Date(action.oldEndDate))
          : "Unknown";
        return `❌ Withdrew membership for ${userName}. Previous end date: ${oldEndDate}`;

      case "archive_user_account":
        return `📁 Archived user account: ${userName}`;

      case "unarchive_user_account":
        return `📂 Activated user account: ${userName}`;

      case "update_user_account":
        const fields =
          action.details?.updatedFields?.join(", ") || "Unknown fields";
        return `✏️ Updated user account for ${userName} (${fields})`;

      case "approve_membership":
        const memberName = action.memberName || userName;
        const plan = action.membershipPlan || "Unknown plan";
        return `✅ Approved ${plan} membership for ${memberName}`;

      case "decline_membership":
        return `❌ Declined membership application for ${userName}`;

      case "member_checkin":
        const checkinMember = action.memberName || userName;
        const checkinType = action.details?.manualEntry
          ? "(Manual Entry)"
          : "(QR Scan)";
        return `🎫 Member check-in ${checkinType} - ${checkinMember}`;

      case "add_walkin_customer": // Handle walk-in customer actions
        const walkinName = action.walkinCustomerName || userName;
        const amount = action.amount ? `₱${action.amount}` : "Unknown amount";
        const paymentMethod = action.paymentMethod || "Unknown method";
        return `👤 Added walk-in customer: ${walkinName} | ${amount} via ${paymentMethod}`;

      case "download_report":
        const reportType = action.reportType || "unknown";
        const period = action.period || "all";
        return `📊 Downloaded ${reportType} report for period: ${getPeriodDisplay(period)}`;

      default:
        return `⚡ Performed action: ${action.action} for ${userName}`;
    }
  }

  function formatUserActionMessage(action) {
    switch (action.actionType) {
      case "login":
        return `🔐 User logged in via ${action.authMethod || "Unknown"}`;

      case "logout":
        return `🚪 User logged out ${
          action.logoutType ? `(${action.logoutType})` : ""
        }`;

      default:
        return `⚡ User performed action: ${action.actionType}`;
    }
  }

  function getAdminActionClass(action) {
    const actionMap = {
      extend_membership: "extend",
      change_plan: "change",
      withdraw_membership: "withdraw",
      archive_user_account: "archive",
      unarchive_user_account: "unarchive",
      update_user_account: "update",
      approve_membership: "approve",
      decline_membership: "decline",
      member_checkin: "checkin",
      add_walkin_customer: "walkin", // Add walk-in action class
      download_report: "download",
    };
    return actionMap[action] || "update";
  }

  function formatActionType(action) {
    const actionMap = {
      extend_membership: "Extend Membership",
      change_plan: "Change Plan",
      withdraw_membership: "Withdraw Membership",
      archive_user_account: "Archive Account",
      unarchive_user_account: "Activate Account",
      update_user_account: "Update Account",
      approve_membership: "Approve Membership",
      decline_membership: "Decline Membership",
      member_checkin: "Member Check-in",
      add_walkin_customer: "Add Walk-in Customer", // Add walk-in action type
      download_report: "Download Report",
    };
    return actionMap[action] || action;
  }

  function formatTimestamp(date) {
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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
