// Admin Active Members Management
class AdminActiveMembers {
  constructor() {
    this.activeMembers = [];
    this.filteredMembers = [];
    this.adminToken = localStorage.getItem("adminToken");
    this.currentMemberDetails = null;
    this.searchTimeout = null;
    this.currentAction = null;
    this.currentActionData = null;
    this.isAssistantAdmin = false; // NEW: Track admin role

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadActiveMembers();
    this.checkAdminRole(); // NEW: Check admin role on init
  }

  // NEW: Check if current admin is an assistant
  checkAdminRole() {
    try {
      const adminData = JSON.parse(localStorage.getItem("adminData") || "{}");
      this.isAssistantAdmin = adminData.isAssistant === true;

      if (this.isAssistantAdmin) {
        console.log("🔒 Assistant admin detected - restricting actions");
        this.disableManagementActions();
      }
    } catch (error) {
      console.error("Error checking admin role:", error);
    }
  }

  // NEW: Disable management actions for assistant admins
  disableManagementActions() {
    // Hide or disable action buttons in the member details modal
    const actionButtons = document.querySelectorAll(`
      .extend-option,
      .change-option,
      #withdrawMembershipBtn
    `);

    actionButtons.forEach((button) => {
      button.style.display = "none";
    });

    // Add assistant restriction notice
    const actionSection = document.querySelector(".action-buttons-section");
    if (actionSection) {
      const restrictionNotice = document.createElement("div");
      restrictionNotice.className = "alert alert-info mt-3";
      restrictionNotice.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <strong>Assistant Admin:</strong> Membership modifications are restricted to full administrators.
      `;
      actionSection.appendChild(restrictionNotice);
    }
  }
  bindEvents() {
    // Refresh active members
    document
      .getElementById("refreshActiveMembersBtn")
      .addEventListener("click", () => {
        this.loadActiveMembers();
      });

    // Search functionality
    const searchInput = document.getElementById("activeMembersSearch");
    const clearSearchBtn = document.getElementById("clearActiveMembersSearch");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.handleSearch(e.target.value);
      });

      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleSearch(e.target.value);
        }
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        this.clearSearch();
      });
    }

    // Membership management actions
    this.bindMembershipActions();
  }

  bindMembershipActions() {
    // NEW: Check if assistant admin before binding actions
    if (this.isAssistantAdmin) {
      console.log("🔒 Skipping action binding for assistant admin");
      return;
    }

    // Extend membership options
    document.querySelectorAll(".extend-option").forEach((button) => {
      button.addEventListener("click", (e) => {
        const months = parseInt(e.target.getAttribute("data-months"));
        this.prepareExtendMembership(months);
      });
    });

    // Change plan options
    document.querySelectorAll(".change-option").forEach((button) => {
      button.addEventListener("click", (e) => {
        const plan = e.target.getAttribute("data-plan");
        const months = parseInt(e.target.getAttribute("data-months"));
        this.prepareChangePlan(plan, months);
      });
    });

    // Withdraw membership
    document
      .getElementById("withdrawMembershipBtn")
      .addEventListener("click", () => {
        this.prepareWithdrawMembership();
      });

    // Confirm action button
    document
      .getElementById("confirmActionBtn")
      .addEventListener("click", () => {
        this.confirmAction();
      });

    // Password input enter key
    document
      .getElementById("adminPassword")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.confirmAction();
        }
      });

    // Clear password error when typing
    document.getElementById("adminPassword").addEventListener("input", () => {
      const errorElement = document.getElementById("passwordError");
      errorElement.style.display = "none";
    });
  }

  handleSearch(searchTerm) {
    const clearSearchBtn = document.getElementById("clearActiveMembersSearch");

    // Show/hide clear button
    if (searchTerm.trim() && clearSearchBtn) {
      clearSearchBtn.style.display = "flex";
    } else if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    // Debounce search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.filterMembers(searchTerm);
    }, 300);
  }

  filterMembers(searchTerm) {
    if (!searchTerm.trim()) {
      this.filteredMembers = [...this.activeMembers];
      this.renderActiveMembers();
      this.updateSearchUI(false);
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    this.filteredMembers = this.activeMembers.filter((member) => {
      const searchableFields = [
        member.firstName,
        member.lastName,
        member.email,
        member.phone,
        member.qrCodeId,
        member.planType,
      ]
        .filter((field) => field)
        .map((field) => field.toLowerCase());

      return searchableFields.some((field) => field.includes(term));
    });

    this.renderActiveMembers(true);
    this.updateSearchUI(true);
  }

  clearSearch() {
    const searchInput = document.getElementById("activeMembersSearch");
    const clearSearchBtn = document.getElementById("clearActiveMembersSearch");

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    this.filteredMembers = [...this.activeMembers];
    this.renderActiveMembers();
    this.updateSearchUI(false);
  }

  updateSearchUI(isSearching) {
    const noResultsElement = document.getElementById(
      "noActiveMembersSearchResults"
    );
    const noMembersElement = document.getElementById("noActiveMembersMessage");

    if (noResultsElement && noMembersElement) {
      if (isSearching && this.filteredMembers.length === 0) {
        noResultsElement.style.display = "block";
        noMembersElement.style.display = "none";
      } else {
        noResultsElement.style.display = "none";
        if (this.activeMembers.length === 0) {
          noMembersElement.style.display = "block";
        } else {
          noMembersElement.style.display = "none";
        }
      }
    }
  }

  async loadActiveMembers() {
    this.showLoading(true);
    try {
      const response = await fetch("/api/admin/active-members", {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch active members");
      }

      const result = await response.json();

      if (result.success) {
        this.activeMembers = result.members;
        this.filteredMembers = [...this.activeMembers];

        // NEW: Update admin role from response if available
        if (result.adminRole === "assistant") {
          this.isAssistantAdmin = true;
          this.disableManagementActions();
        }

        this.renderActiveMembers();
        this.updatePlanTypeStatistics();
        this.clearSearch(); // Reset search when reloading
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error loading active members:", error);
      this.showAlert(
        "Failed to load active members: " + error.message,
        "danger"
      );
    } finally {
      this.showLoading(false);
    }
  }

  renderActiveMembers(isSearching = false) {
    const tableBody = document.getElementById("activeMembersTableBody");
    const noMembersMessage = document.getElementById("noActiveMembersMessage");
    const countElement = document.getElementById("activeMembersCount");

    const membersToRender = isSearching
      ? this.filteredMembers
      : this.activeMembers;

    if (membersToRender.length === 0) {
      tableBody.innerHTML = "";
      if (!isSearching) {
        noMembersMessage.style.display = "block";
      }
      countElement.textContent = "0 members";
      return;
    }

    noMembersMessage.style.display = "none";
    countElement.textContent = `${this.activeMembers.length} members`;

    tableBody.innerHTML = membersToRender
      .map((member) => {
        return `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <img src="${
                member.profilePicture || "/images/default-profile.png"
              }" 
                   alt="Profile" 
                   class="rounded-circle me-3"
                   style="width: 40px; height: 40px; object-fit: cover;"
                   onerror="this.src='/images/default-profile.png'">
              <div>
                <div class="fw-bold">${member.firstName} ${
          member.lastName
        }</div>
                <small class="text-muted">${member.email}</small>
              </div>
            </div>
          </td>
          <td>
            <code style="background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 4px;">${
              member.qrCodeId
            }</code>
          </td>
          <td>
            <span class="plan-badge plan-${
              member.planType ? member.planType.toLowerCase() : "basic"
            }">
              ${member.planType}
            </span>
          </td>
          <td>${new Date(member.startDate).toLocaleDateString()}</td>
          <td>${new Date(member.endDate).toLocaleDateString()}</td>
          <td>
            <span class="badge ${
              member.remainingDays > 30
                ? "bg-success"
                : member.remainingDays > 7
                ? "bg-warning"
                : "bg-danger"
            }">
              ${member.remainingDays} days
            </span>
          </td>
          <td>
            <button class="btn btn-primary btn-sm view-member-details" 
                    data-member-id="${member._id}">
              <i class="fas fa-eye"></i> View Details
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    // Add event listeners to view details buttons
    tableBody.querySelectorAll(".view-member-details").forEach((button) => {
      button.addEventListener("click", (e) => {
        const memberId = e.target
          .closest(".view-member-details")
          .getAttribute("data-member-id");
        this.showMemberDetails(memberId);
      });
    });
  }

  async showMemberDetails(memberId) {
    this.showLoading(true);
    try {
      const response = await fetch(`/api/admin/member-details/${memberId}`, {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch member details");
      }

      const result = await response.json();

      if (result.success) {
        this.currentMemberDetails = result.memberDetails;

        // NEW: Update admin role from response if available
        if (result.adminRole === "assistant") {
          this.isAssistantAdmin = true;
          this.disableManagementActions();
        }

        await this.populateMemberDetailsModal();
        this.showMemberDetailsModal();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error loading member details:", error);
      this.showAlert(
        "Failed to load member details: " + error.message,
        "danger"
      );
    } finally {
      this.showLoading(false);
    }
  }

  prepareExtendMembership(months) {
    if (this.isAssistantAdmin) {
      this.showAlert(
        "Assistant admins are not authorized to extend memberships.",
        "warning"
      );
      return;
    }

    if (!this.currentMemberDetails) return;

    const { membership } = this.currentMemberDetails;
    const currentEndDate = new Date(membership.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    this.currentAction = "extend";
    this.currentActionData = {
      months: months,
      newEndDate: newEndDate.toISOString().split("T")[0],
    };

    this.showPasswordConfirmation(
      "Extend Membership",
      `Extend membership by ${months} month${months > 1 ? "s" : ""}`,
      `This will extend the membership from ${currentEndDate.toLocaleDateString()} to ${newEndDate.toLocaleDateString()}.`
    );
  }

  async populateMemberDetailsModal() {
    const { membership, user, statistics } = this.currentMemberDetails;

    // Basic member info
    const profilePicture = document.getElementById(
      "memberDetailProfilePicture"
    );
    profilePicture.src = user?.profilePicture || "/images/default-profile.png";
    profilePicture.onerror = function () {
      this.src = "/images/default-profile.png";
    };

    document.getElementById(
      "memberDetailName"
    ).textContent = `${membership.firstName} ${membership.lastName}`;
    document.getElementById("memberDetailEmail").textContent = membership.email;
    document.getElementById("memberDetailPhone").textContent =
      membership.phone || "N/A";
    document.getElementById("memberDetailPlanType").textContent =
      membership.planType;
    document.getElementById("memberDetailStartDate").textContent = new Date(
      membership.startDate
    ).toLocaleDateString();
    document.getElementById("memberDetailEndDate").textContent = new Date(
      membership.endDate
    ).toLocaleDateString();

    // Calculate remaining days
    const today = new Date();
    const endDate = new Date(membership.endDate);
    const remainingDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const remainingDaysDisplay = remainingDays > 0 ? remainingDays : 0;

    // Plan badge
    const planBadge = document.getElementById("memberDetailPlanBadge");
    planBadge.className = `plan-badge plan-${
      membership.planType ? membership.planType.toLowerCase() : "basic"
    }`;
    planBadge.textContent = membership.planType;

    // QR Code ID
    document.getElementById(
      "memberQrCodeId"
    ).textContent = `QR Code ID: ${membership.qrCodeId}`;

    // Display QR code image
    await this.displayQRCodeImage(membership, user);

    // Statistics
    document.getElementById("statTotalCheckins").textContent =
      statistics.totalCheckins;
    document.getElementById("statMissedCheckins").textContent =
      statistics.missedCheckins;
    document.getElementById(
      "statCheckinRate"
    ).textContent = `${statistics.checkinRate}%`;
    document.getElementById("statRemainingDays").textContent =
      remainingDaysDisplay;

    // Initialize calendar
    this.initializeCalendar();
  }

  async displayQRCodeImage(membership, user) {
    const qrCodeImage = document.getElementById("memberQrCodeImage");

    let qrCodeSrc = null;

    // Check if QR code picture exists in user data
    if (user && user.qrCodePicture) {
      qrCodeSrc = user.qrCodePicture;
    }

    // Try to construct path from QR code ID
    if (!qrCodeSrc && membership.qrCodeId) {
      const possiblePaths = [
        `../images/qrImages/${membership.qrCodeId}.png`,
        `../images/qrImages/${membership.qrCodeId}.jpg`,
        `../uploads/qrImages/${membership.qrCodeId}.png`,
      ];

      for (const path of possiblePaths) {
        const exists = await this.checkImageExists(path);
        if (exists) {
          qrCodeSrc = path;
          break;
        }
      }
    }

    // Set the image source or use default
    if (qrCodeSrc) {
      qrCodeImage.src = qrCodeSrc;
      qrCodeImage.onerror = () => {
        qrCodeImage.src = "/images/default-qrcode.png";
      };
    } else {
      qrCodeImage.src = "/images/default-qrcode.png";
    }

    qrCodeImage.alt = `QR Code for ${membership.qrCodeId}`;
  }

  async checkImageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  initializeCalendar() {
    const { membership, checkins } = this.currentMemberDetails;

    // Extract check-in dates
    const checkinDates = checkins.map((checkin) => checkin.checkinTime);

    // Initialize calendar
    if (window.membershipCalendar) {
      window.membershipCalendar.destroy();
    }

    window.membershipCalendar = new MembershipCalendar("calendarSection", {
      startDate: membership.startDate,
      endDate: membership.endDate,
      checkinDates: checkinDates,
      showLegend: true,
    });
  }

  showMemberDetailsModal() {
    const modal = new bootstrap.Modal(
      document.getElementById("memberDetailsModal")
    );
    modal.show();
  }

  // Membership Management Methods
  prepareExtendMembership(months) {
    if (!this.currentMemberDetails) return;

    const { membership } = this.currentMemberDetails;
    const currentEndDate = new Date(membership.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    this.currentAction = "extend";
    this.currentActionData = {
      months: months,
      newEndDate: newEndDate.toISOString().split("T")[0],
    };

    this.showPasswordConfirmation(
      "Extend Membership",
      `Extend membership by ${months} month${months > 1 ? "s" : ""}`,
      `This will extend the membership from ${currentEndDate.toLocaleDateString()} to ${newEndDate.toLocaleDateString()}.`
    );
  }
  prepareChangePlan(newPlan, months) {
    if (this.isAssistantAdmin) {
      this.showAlert(
        "Assistant admins are not authorized to change membership plans.",
        "warning"
      );
      return;
    }

    if (!this.currentMemberDetails) return;

    const { membership } = this.currentMemberDetails;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    this.currentAction = "change";
    this.currentActionData = {
      newPlan: newPlan,
      months: months,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };

    this.showPasswordConfirmation(
      "Change Membership Plan",
      `Change plan to ${newPlan} (${months} month${months > 1 ? "s" : ""})`,
      `This will change the membership plan from ${
        membership.planType
      } to ${newPlan}. The membership period will be reset to ${months} month${
        months > 1 ? "s" : ""
      } starting today.`
    );
  }

  prepareWithdrawMembership() {
    if (this.isAssistantAdmin) {
      this.showAlert(
        "Assistant admins are not authorized to withdraw memberships.",
        "warning"
      );
      return;
    }

    if (!this.currentMemberDetails) return;

    const { membership } = this.currentMemberDetails;

    this.currentAction = "withdraw";
    this.currentActionData = {};

    this.showPasswordConfirmation(
      "Withdraw Membership",
      "Immediately expire membership",
      `This will immediately expire the membership for ${membership.firstName} ${membership.lastName}. The member will no longer have access to the gym facilities.`
    );
  }

  showPasswordConfirmation(title, action, description) {
    document.getElementById("passwordModalTitle").textContent = title;
    document.getElementById("actionDescription").innerHTML = `
      <h6>${action}</h6>
      <p>${description}</p>
    `;
    document.getElementById("adminPassword").value = "";
    document.getElementById("passwordError").style.display = "none";

    const modal = new bootstrap.Modal(
      document.getElementById("passwordConfirmModal")
    );
    modal.show();
  }

  async confirmAction() {
    // NEW: Final check before confirming action
    if (this.isAssistantAdmin) {
      this.showAlert(
        "Assistant admins are not authorized to perform membership modifications.",
        "warning"
      );

      // Close the password modal
      const passwordModalElement = document.getElementById(
        "passwordConfirmModal"
      );
      const passwordModal = bootstrap.Modal.getInstance(passwordModalElement);
      if (passwordModal) {
        passwordModal.hide();
      }
      return;
    }

    const password = document.getElementById("adminPassword").value;
    const errorElement = document.getElementById("passwordError");

    if (!password) {
      errorElement.textContent = "Please enter your admin password.";
      errorElement.style.display = "block";
      return;
    }

    this.showLoading(true);

    try {
      // First verify admin password
      const verifyResponse = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: password }),
      });

      if (!verifyResponse.ok) {
        throw new Error("Password verification failed");
      }

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        errorElement.textContent = "Invalid admin password. Please try again.";
        errorElement.style.display = "block";
        this.showLoading(false);
        return;
      }

      // Password verified, proceed with the action
      await this.executeMembershipAction();
    } catch (error) {
      console.error("Error verifying password:", error);
      errorElement.textContent = "Error verifying password. Please try again.";
      errorElement.style.display = "block";
      this.showLoading(false);
    }
  }

  async executeMembershipAction() {
    if (!this.currentMemberDetails || !this.currentAction) {
      this.showLoading(false);
      return;
    }

    const { membership } = this.currentMemberDetails;
    const memberId = membership._id;

    try {
      let endpoint = "";
      let method = "POST";
      let body = {};

      switch (this.currentAction) {
        case "extend":
          endpoint = `/api/admin/members/${memberId}/extend`;
          body = {
            months: this.currentActionData.months,
            newEndDate: this.currentActionData.newEndDate,
          };
          break;

        case "change":
          endpoint = `/api/admin/members/${memberId}/change-plan`;
          body = {
            newPlan: this.currentActionData.newPlan,
            startDate: this.currentActionData.startDate,
            endDate: this.currentActionData.endDate,
          };
          break;

        case "withdraw":
          endpoint = `/api/admin/members/${memberId}/withdraw`;
          body = {};
          break;
      }

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.showAlert(
          `Membership ${this.getActionDescription()} completed successfully!`,
          "success"
        );

        // Close the password modal properly
        const passwordModalElement = document.getElementById(
          "passwordConfirmModal"
        );
        const passwordModal = bootstrap.Modal.getInstance(passwordModalElement);

        if (passwordModal) {
          passwordModal.hide();

          // Manually remove the backdrop if it persists
          setTimeout(() => {
            const backdrops = document.getElementsByClassName("modal-backdrop");
            while (backdrops.length > 0) {
              backdrops[0].parentNode.removeChild(backdrops[0]);
            }
            // Remove modal-open class from body
            document.body.classList.remove("modal-open");
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
          }, 300);
        }

        // Refresh member details and active members list
        await this.showMemberDetails(memberId);
        await this.loadActiveMembers();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(`Error executing ${this.currentAction}:`, error);
      this.showAlert(
        `Failed to ${this.getActionDescription()}: ${error.message}`,
        "danger"
      );
    } finally {
      this.showLoading(false);
      this.currentAction = null;
      this.currentActionData = null;
    }
  }

  getActionDescription() {
    switch (this.currentAction) {
      case "extend":
        return "extend";
      case "change":
        return "change plan";
      case "withdraw":
        return "withdraw";
      default:
        return "perform action";
    }
  }

  updatePlanTypeStatistics() {
    // Count members by plan type
    const basicCount = this.activeMembers.filter(
      (member) => member.planType === "Basic"
    ).length;
    const premiumCount = this.activeMembers.filter(
      (member) => member.planType === "Premium"
    ).length;
    const vipCount = this.activeMembers.filter(
      (member) => member.planType === "VIP"
    ).length;

    // Update the statistics cards
    this.updateStatisticsCards(basicCount, premiumCount, vipCount);
  }

  updateStatisticsCards(basicCount, premiumCount, vipCount) {
    // Update the existing cards to show plan type counts
    const statsGrid = document.querySelector(".stats-grid");

    // Update card contents
    const cards = statsGrid.querySelectorAll(".stat-card");

    if (cards.length >= 3) {
      // Card 1: Basic Plan
      cards[0].querySelector(".stat-number").textContent = basicCount;
      cards[0].querySelector(".stat-label").textContent = "Basic Plan";

      // Card 2: Premium Plan
      cards[1].querySelector(".stat-number").textContent = premiumCount;
      cards[1].querySelector(".stat-label").textContent = "Premium Plan";

      // Card 3: VIP Plan
      cards[2].querySelector(".stat-number").textContent = vipCount;
      cards[2].querySelector(".stat-label").textContent = "VIP Plan";
    }
  }

  showLoading(show) {
    const loadingOverlay = document.getElementById("loadingOverlay");
    if (loadingOverlay) {
      loadingOverlay.style.display = show ? "flex" : "none";
    }
  }

  showAlert(message, type) {
    const alertContainer = document.getElementById("alertContainer");
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  window.adminActiveMembers = new AdminActiveMembers();
});
