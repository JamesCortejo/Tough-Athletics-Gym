document.addEventListener("DOMContentLoaded", function () {
  const adminToken = localStorage.getItem("adminToken");
  const currentAdmin = localStorage.getItem("currentAdmin");

  // Check if admin is authenticated
  if (!adminToken || !currentAdmin) {
    window.location.href = "/admin/login";
    return;
  }

  let pendingApplications = [];
  let filteredApplications = [];
  let currentApplicationId = null;
  let searchTimeout = null;

  // Initialize the page
  initializePage();

  // Event Listeners
  document
    .getElementById("refreshBtn")
    .addEventListener("click", loadPendingApplications);
  document
    .getElementById("approveBtn")
    .addEventListener("click", handleApprove);
  document
    .getElementById("declineBtn")
    .addEventListener("click", showDeclineReasonModal);
  document
    .getElementById("confirmDeclineBtn")
    .addEventListener("click", handleDecline);

  // Search functionality for pending applications
  const searchInput = document.getElementById("pendingApplicationsSearch");
  const clearSearchBtn = document.getElementById(
    "clearPendingApplicationsSearch"
  );

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handlePendingApplicationsSearch(e.target.value);
    });

    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handlePendingApplicationsSearch(e.target.value);
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", clearPendingApplicationsSearch);
  }

  // Navigation
  document.querySelector(".overview-btn").addEventListener("click", () => {
    window.location.href = "/admin/overview";
  });

  document
    .querySelector(".membership-btn")
    .addEventListener("click", function () {
      window.location.href = "/admin/membership-manager";
    });

  document.querySelector(".accounts-btn").addEventListener("click", () => {
    showAlert("Accounts Manager coming soon!", "info");
  });

  document.querySelector(".reports-btn").addEventListener("click", () => {
    showAlert("Reports Manager coming soon!", "info");
  });

  document
    .querySelector(".logout-btn")
    .addEventListener("click", showLogoutModal);

  // Logout modal handlers
  document
    .getElementById("logoutConfirmBtn")
    .addEventListener("click", handleLogout);
  document
    .getElementById("logoutCancelBtn")
    .addEventListener("click", hideLogoutModal);

  async function initializePage() {
    await loadPendingApplications();
  }

  function handlePendingApplicationsSearch(searchTerm) {
    const clearSearchBtn = document.getElementById(
      "clearPendingApplicationsSearch"
    );

    // Show/hide clear button
    if (searchTerm.trim() && clearSearchBtn) {
      clearSearchBtn.style.display = "flex";
    } else if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterPendingApplications(searchTerm);
    }, 300);
  }

  function filterPendingApplications(searchTerm) {
    if (!searchTerm.trim()) {
      filteredApplications = [...pendingApplications];
      displayApplications(filteredApplications);
      updateSearchUI(false);
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    filteredApplications = pendingApplications.filter((application) => {
      const searchableFields = [
        application.firstName,
        application.lastName,
        application.email,
        application.phone,
        application.planType,
        application.paymentMethod,
      ]
        .filter((field) => field)
        .map((field) => field.toLowerCase());

      return searchableFields.some((field) => field.includes(term));
    });

    displayApplications(filteredApplications);
    updateSearchUI(true);
  }

  function clearPendingApplicationsSearch() {
    const searchInput = document.getElementById("pendingApplicationsSearch");
    const clearSearchBtn = document.getElementById(
      "clearPendingApplicationsSearch"
    );

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    filteredApplications = [...pendingApplications];
    displayApplications(filteredApplications);
    updateSearchUI(false);
  }

  function updateSearchUI(isSearching) {
    const noResultsElement = document.getElementById(
      "noApplicationsSearchResults"
    );
    const noApplicationsElement = document.getElementById(
      "noApplicationsMessage"
    );

    if (noResultsElement && noApplicationsElement) {
      if (isSearching && filteredApplications.length === 0) {
        noResultsElement.style.display = "block";
        noApplicationsElement.style.display = "none";
      } else {
        noResultsElement.style.display = "none";
        if (pendingApplications.length === 0) {
          noApplicationsElement.style.display = "block";
        } else {
          noApplicationsElement.style.display = "none";
        }
      }
    }
  }

  async function loadPendingApplications() {
    showLoading(true);

    try {
      const response = await fetch(
        "/api/membership/admin/pending-applications",
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
        pendingApplications = result.applications;
        filteredApplications = [...pendingApplications];
        displayApplications(filteredApplications);
        updateStatistics(pendingApplications);
        clearPendingApplicationsSearch(); // Reset search when reloading
      } else {
        showAlert("Failed to load applications: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error loading applications:", error);
      showAlert("Error loading applications. Please try again.", "danger");
      // Display empty state
      pendingApplications = [];
      filteredApplications = [];
      displayApplications([]);
      updateStatistics([]);
    } finally {
      showLoading(false);
    }
  }

  function displayApplications(applications) {
    const tableBody = document.getElementById("applicationsTableBody");
    const noApplicationsMessage = document.getElementById(
      "noApplicationsMessage"
    );
    const applicationsCount = document.getElementById("applicationsCount");

    // Update applications count
    applicationsCount.textContent = `${pendingApplications.length} application${
      pendingApplications.length !== 1 ? "s" : ""
    }`;

    if (applications.length === 0) {
      tableBody.innerHTML = "";
      if (
        applications === filteredApplications &&
        pendingApplications.length > 0
      ) {
        // This means we have applications but search returned no results
        noApplicationsMessage.style.display = "none";
      } else {
        noApplicationsMessage.style.display = "block";
      }
      return;
    }

    noApplicationsMessage.style.display = "none";

    tableBody.innerHTML = applications
      .map(
        (application) => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${
                          application.profilePicture ||
                          "/images/default-profile.png"
                        }" 
                             alt="Profile" 
                             class="rounded-circle me-3"
                             style="width: 40px; height: 40px; object-fit: cover;">
                        <div>
                            <strong>${application.firstName} ${
          application.lastName
        }</strong>
                            <div class="small text-muted">${
                              application.email
                            }</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="plan-badge plan-${
                      application.planType
                        ? application.planType.toLowerCase()
                        : "basic"
                    }">
                        ${application.planType || "Unknown"}
                    </span>
                </td>
                <td>₱${application.amount || "0"}</td>
                <td>${
                  application.appliedAt
                    ? formatDate(new Date(application.appliedAt))
                    : "Unknown"
                }</td>
                <td>${application.paymentMethod || "Not specified"}</td>
                <td>
                    <button class="btn btn-primary btn-sm btn-action view-details-btn" 
                            data-membership-id="${application._id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </td>
            </tr>
        `
      )
      .join("");

    // Add event listeners to view details buttons
    document.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const membershipId = this.getAttribute("data-membership-id");
        showApplicationDetails(membershipId);
      });
    });
  }

  async function showApplicationDetails(membershipId) {
    showLoading(true);

    try {
      const response = await fetch(
        `/api/membership/admin/application/${membershipId}`,
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
        displayApplicationModal(result.application);
        currentApplicationId = membershipId;
      } else {
        showAlert(
          "Failed to load application details: " + result.message,
          "danger"
        );
      }
    } catch (error) {
      console.error("Error loading application details:", error);
      showAlert("Error loading application details.", "danger");
    } finally {
      showLoading(false);
    }
  }

  function displayApplicationModal(application) {
    if (!application) {
      showAlert("No application data found", "danger");
      return;
    }

    // Set modal content with fallbacks
    document.getElementById("detailProfilePicture").src =
      application.profilePicture || "/images/default-profile.png";
    document.getElementById("detailFirstName").textContent =
      application.firstName || "Unknown";
    document.getElementById("detailLastName").textContent =
      application.lastName || "Unknown";
    document.getElementById("detailEmail").textContent =
      application.email || "Unknown";
    document.getElementById("detailPhone").textContent =
      application.phone || application.mobile || "N/A";
    document.getElementById("detailPlanType").textContent =
      application.planType || "Unknown";
    document.getElementById("detailAmount").textContent = `₱${
      application.amount || "0"
    }`;
    document.getElementById("detailAppliedAt").textContent =
      application.appliedAt
        ? formatDate(new Date(application.appliedAt))
        : "Unknown";
    document.getElementById("detailPaymentMethod").textContent =
      application.paymentMethod || "Not specified";
    document.getElementById("detailQrCodeId").textContent =
      application.qrCodeId || "N/A";

    // Set plan badge
    const planBadge = document.getElementById("detailPlanBadge");
    planBadge.className = `plan-badge plan-${
      application.planType ? application.planType.toLowerCase() : "basic"
    }`;
    planBadge.textContent = application.planType || "Unknown";

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("applicationModal")
    );
    modal.show();
  }

  async function handleApprove() {
    if (!currentApplicationId) return;

    showLoading(true);

    try {
      const response = await fetch(
        `/api/membership/admin/approve/${currentApplicationId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        showAlert("Application approved successfully!", "success");
        // Close modal and refresh applications
        bootstrap.Modal.getInstance(
          document.getElementById("applicationModal")
        ).hide();
        await loadPendingApplications();
      } else {
        showAlert("Failed to approve application: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error approving application:", error);
      showAlert("Error approving application.", "danger");
    } finally {
      showLoading(false);
      currentApplicationId = null;
    }
  }

  function showDeclineReasonModal() {
    document.getElementById("declineReason").value = "";
    const declineModal = new bootstrap.Modal(
      document.getElementById("declineReasonModal")
    );
    declineModal.show();
  }

  async function handleDecline() {
    if (!currentApplicationId) return;

    const reason = document.getElementById("declineReason").value;

    if (!reason.trim()) {
      showAlert(
        "Please provide a reason for declining the application.",
        "warning"
      );
      return;
    }

    showLoading(true);

    try {
      const response = await fetch(
        `/api/membership/admin/decline/${currentApplicationId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        showAlert("Application declined successfully!", "success");
        // Close both modals and refresh applications
        bootstrap.Modal.getInstance(
          document.getElementById("declineReasonModal")
        ).hide();
        bootstrap.Modal.getInstance(
          document.getElementById("applicationModal")
        ).hide();
        await loadPendingApplications();
      } else {
        showAlert("Failed to decline application: " + result.message, "danger");
      }
    } catch (error) {
      console.error("Error declining application:", error);
      showAlert("Error declining application.", "danger");
    } finally {
      showLoading(false);
      currentApplicationId = null;
    }
  }

  function updateStatistics(applications) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const applicationsThisWeek = applications.filter(
      (app) => app.appliedAt && new Date(app.appliedAt) >= startOfWeek
    );

    const applicationsThisMonth = applications.filter(
      (app) => app.appliedAt && new Date(app.appliedAt) >= startOfMonth
    );

    // Update statistics - show dash if no data
    document.getElementById("totalPending").textContent =
      applications.length > 0 ? applications.length : "-";
    document.getElementById("applicationsThisWeek").textContent =
      applicationsThisWeek.length > 0 ? applicationsThisWeek.length : "-";
    document.getElementById("applicationsThisMonth").textContent =
      applicationsThisMonth.length > 0 ? applicationsThisMonth.length : "-";
  }

  function formatDate(date) {
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showLoading(show) {
    document.getElementById("loadingOverlay").style.display = show
      ? "flex"
      : "none";
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

  function showLogoutModal() {
    document.getElementById("logoutModal").style.display = "flex";
  }

  function hideLogoutModal() {
    document.getElementById("logoutModal").style.display = "none";
  }

  function handleLogout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("currentAdmin");
    window.location.href = "/admin/login";
  }
});
