// adminNonMemberManager.js
document.addEventListener("DOMContentLoaded", function () {
  const adminToken = localStorage.getItem("adminToken");
  const currentAdmin = localStorage.getItem("currentAdmin");

  // Check if admin is authenticated
  if (!adminToken || !currentAdmin) {
    window.location.href = "/admin/login";
    return;
  }

  let allNonMembers = [];
  let filteredNonMembers = [];
  let searchTimeout = null;

  // Initialize the page
  initializePage();

  // Event Listeners
  document
    .getElementById("refreshNonMembersBtn")
    .addEventListener("click", loadNonMembers);
  document
    .getElementById("addNonMemberBtn")
    .addEventListener("click", showAddNonMemberModal);
  document
    .getElementById("addFirstNonMemberBtn")
    .addEventListener("click", showAddNonMemberModal);
  document
    .getElementById("saveNonMemberBtn")
    .addEventListener("click", saveNonMember);

  // Search functionality
  const searchInput = document.getElementById("nonMembersSearch");
  const clearSearchBtn = document.getElementById("clearNonMembersSearch");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleNonMembersSearch(e.target.value);
    });

    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleNonMembersSearch(e.target.value);
      }
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", clearNonMembersSearch);
  }

  async function initializePage() {
    await loadNonMembers();
  }

  function handleNonMembersSearch(searchTerm) {
    const clearSearchBtn = document.getElementById("clearNonMembersSearch");

    // Show/hide clear button
    if (searchTerm.trim() && clearSearchBtn) {
      clearSearchBtn.style.display = "flex";
    } else if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterNonMembers(searchTerm);
    }, 300);
  }

  function filterNonMembers(searchTerm) {
    if (!searchTerm.trim()) {
      filteredNonMembers = [...allNonMembers];
      displayNonMembers(filteredNonMembers);
      updateSearchUI(false);
      return;
    }

    const term = searchTerm.toLowerCase().trim();

    filteredNonMembers = allNonMembers.filter((customer) => {
      const searchableFields = [
        customer.firstName,
        customer.lastName,
        customer.email,
        customer.phone,
        customer.address,
        customer.gender,
      ]
        .filter((field) => field)
        .map((field) => field.toLowerCase());

      return searchableFields.some((field) => field.includes(term));
    });

    displayNonMembers(filteredNonMembers);
    updateSearchUI(true);
  }

  function clearNonMembersSearch() {
    const searchInput = document.getElementById("nonMembersSearch");
    const clearSearchBtn = document.getElementById("clearNonMembersSearch");

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    if (clearSearchBtn) {
      clearSearchBtn.style.display = "none";
    }

    filteredNonMembers = [...allNonMembers];
    displayNonMembers(filteredNonMembers);
    updateSearchUI(false);
  }

  function updateSearchUI(isSearching) {
    const noResultsElement = document.getElementById(
      "noNonMembersSearchResults"
    );
    const noNonMembersElement = document.getElementById("noNonMembersMessage");

    if (noResultsElement && noNonMembersElement) {
      if (isSearching && filteredNonMembers.length === 0) {
        noResultsElement.style.display = "block";
        noNonMembersElement.style.display = "none";
      } else {
        noResultsElement.style.display = "none";
        if (allNonMembers.length === 0) {
          noNonMembersElement.style.display = "block";
        } else {
          noNonMembersElement.style.display = "none";
        }
      }
    }
  }

  async function loadNonMembers() {
    showLoading(true);

    try {
      const response = await fetch("/api/non-members", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        allNonMembers = result.nonMembers;
        filteredNonMembers = [...allNonMembers];

        displayNonMembers(filteredNonMembers);
        updateStatistics(allNonMembers);
        clearNonMembersSearch(); // Reset search when reloading
      } else {
        showAlert(
          "Failed to load walk-in customers: " + result.message,
          "danger"
        );
      }
    } catch (error) {
      console.error("Error loading walk-in customers:", error);
      showAlert("Error loading walk-in customers. Please try again.", "danger");
      // Display empty state
      allNonMembers = [];
      filteredNonMembers = [];
      displayNonMembers([]);
      updateStatistics([]);
    } finally {
      showLoading(false);
    }
  }

  function displayNonMembers(nonMembers) {
    const tableBody = document.getElementById("nonMembersTableBody");
    const noNonMembersMessage = document.getElementById("noNonMembersMessage");
    const nonMembersCount = document.getElementById("nonMembersCount");

    // Update non-members count
    nonMembersCount.textContent = `${allNonMembers.length} customer${
      allNonMembers.length !== 1 ? "s" : ""
    }`;

    if (nonMembers.length === 0) {
      tableBody.innerHTML = "";
      if (nonMembers === filteredNonMembers && allNonMembers.length > 0) {
        // This means we have non-members but search returned no results
        noNonMembersMessage.style.display = "none";
      } else {
        noNonMembersMessage.style.display = "block";
      }
      return;
    }

    noNonMembersMessage.style.display = "none";

    tableBody.innerHTML = nonMembers
      .map((customer) => {
        const checkInTime = customer.checkInTime
          ? new Date(customer.checkInTime)
          : new Date();
        const initials = `${customer.firstName?.charAt(0) || ""}${
          customer.lastName?.charAt(0) || ""
        }`.toUpperCase();

        return `
            <tr class="walkin-customer-row">
                <td>
                    <div class="customer-info">
                        <div class="customer-avatar">${initials}</div>
                        <div class="customer-details">
                            <div class="customer-name">${customer.firstName} ${
          customer.lastName
        }</div>
                            <div class="customer-gender">${
                              customer.gender
                                ? customer.gender.charAt(0).toUpperCase() +
                                  customer.gender.slice(1)
                                : "Not specified"
                            }</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${customer.phone || "No phone"}</div>
                    <div class="small text-muted">${
                      customer.email || "No email"
                    }</div>
                </td>
                <td class="address-cell">
                    <div class="small">${customer.address || "No address"}</div>
                </td>
                <td>
                    <div class="checkin-time">${formatTime(checkInTime)}</div>
                    <div class="checkin-date">${formatDate(checkInTime)}</div>
                </td>
                <td>
                    <span class="badge badge-payment">₱75.00 - ${
                      customer.paymentMethod || "Cash at Gym"
                    }</span>
                </td>
            </tr>
        `;
      })
      .join("");
  }

  function showAddNonMemberModal() {
    // Reset form
    document.getElementById("addNonMemberForm").reset();

    const modal = new bootstrap.Modal(
      document.getElementById("addNonMemberModal")
    );
    modal.show();
  }

  async function saveNonMember() {
    const formData = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      gender: document.getElementById("gender").value,
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim() || null,
      address: document.getElementById("address").value.trim(),
      paymentMethod: "Cash at Gym",
      amount: 75,
    };

    // Validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.gender ||
      !formData.phone ||
      !formData.address
    ) {
      showAlert("Please fill in all required fields", "warning");
      return;
    }

    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      showAlert("Please enter a valid phone number", "warning");
      return;
    }

    if (formData.email && !isValidEmail(formData.email)) {
      showAlert("Please enter a valid email address", "warning");
      return;
    }

    showLoading(true);

    try {
      const response = await fetch("/api/non-members", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        showAlert("Walk-in customer added successfully!", "success");

        // Close modal
        bootstrap.Modal.getInstance(
          document.getElementById("addNonMemberModal")
        ).hide();

        // Reload non-members
        await loadNonMembers();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error adding walk-in customer:", error);
      showAlert("Error adding walk-in customer: " + error.message, "danger");
    } finally {
      showLoading(false);
    }
  }

  function updateStatistics(nonMembers) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const todayNonMembers = nonMembers.filter((customer) => {
      const checkInTime = customer.checkInTime
        ? new Date(customer.checkInTime)
        : new Date(customer.createdAt);
      return checkInTime >= today;
    });

    const totalRevenue = nonMembers.length * 75;

    // Update statistics
    document.getElementById("totalNonMembers").textContent =
      nonMembers.length > 0 ? nonMembers.length : "-";
    document.getElementById("todayNonMembers").textContent =
      todayNonMembers.length > 0 ? todayNonMembers.length : "-";
    document.getElementById("totalRevenue").textContent = `₱${totalRevenue}`;
  }

  function isValidPhoneNumber(phone) {
    const phoneRegex = /^[0-9+\-\s()]{10,}$/;
    return phoneRegex.test(phone);
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  function formatTime(date) {
    if (isNaN(date.getTime())) {
      return "Invalid Time";
    }

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
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
