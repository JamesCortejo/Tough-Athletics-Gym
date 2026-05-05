// userstat.js - Updated with Check-in Data and Calendar
document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!token || !currentUser) {
    window.location.href = "/?error=login_required";
    return;
  }

  // Calendar instance
  let membershipCalendar = null;

  // Fetch membership status
  fetchMembershipStatus();

  async function fetchMembershipStatus() {
    try {
      // First check for active membership
      const activeResponse = await fetch("/api/membership/current", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const activeResult = await activeResponse.json();

      if (activeResult.success && activeResult.membership) {
        await displayActiveMembership(activeResult.membership);
      } else {
        // Check for pending membership
        const pendingResponse = await fetch("/api/membership/pending", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const pendingResult = await pendingResponse.json();

        if (pendingResult.success && pendingResult.membership) {
          displayPendingMembership(pendingResult.membership);
        } else {
          // Check membership history for most recent expired membership
          const historyResponse = await fetch("/api/membership/history", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const historyResult = await historyResponse.json();
          const expiredMembership =
            historyResult.success && Array.isArray(historyResult.memberships)
              ? findMostRecentExpiredMembership(historyResult.memberships)
              : null;

          if (expiredMembership) {
            await displayExpiredMembership(expiredMembership);
          } else {
            displayNoMembership();
          }
        }
      }
    } catch (error) {
      console.error("Error fetching membership status:", error);
      displayNoMembership();
    }
  }

  // Add this function to userstat.js to ensure proper calendar display
  function initializeCalendar(startDate, endDate, checkinDates = []) {
    // Show calendar section
    const calendarSection = document.getElementById("calendarSection");
    if (calendarSection) {
      calendarSection.style.display = "block";
    }

    console.log("📅 Initializing calendar with:", {
      startDate: startDate,
      endDate: endDate,
      checkinDates: checkinDates,
    });

    // Initialize or update calendar component
    if (window.membershipCalendar) {
      window.membershipCalendar.updateDates(startDate, endDate);
      window.membershipCalendar.updateCheckins(checkinDates);
    } else {
      window.membershipCalendar = new MembershipCalendar("calendarSection", {
        startDate: startDate,
        endDate: endDate,
        checkinDates: checkinDates,
        onDateClick: function (date) {
          console.log("Date clicked:", date);
          // You can add click functionality here if needed
        },
      });
    }
  }

  async function displayActiveMembership(membership) {
    console.log("Displaying active membership:", membership);

    const membershipEndDateCheck = membership.endDate
      ? new Date(membership.endDate)
      : null;
    if (
      membershipEndDateCheck &&
      !isNaN(membershipEndDateCheck.getTime()) &&
      membershipEndDateCheck.getTime() < Date.now()
    ) {
      await displayExpiredMembership(membership);
      return;
    }

    // Hide other sections
    document.getElementById("noMembership").style.display = "none";
    document.getElementById("pendingMembership").style.display = "none";

    // Show active membership sections
    document.querySelector(".status-details").style.display = "block";
    document.getElementById("calendarSection").classList.remove("calendar-expired");
    resetNoMembershipSection();

    // Update status pill and plan type badge
    updateStatusHeader("Active", membership.planType);

    // Format dates
    const membershipStartDate = new Date(membership.startDate);
    const membershipEndDate = new Date(membership.endDate);
    const today = new Date();

    // Calculate remaining days
    const timeDiff = membershipEndDate.getTime() - today.getTime();
    const remainingDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Update details
    document.getElementById("startDate").textContent =
      formatDate(membershipStartDate);
    document.getElementById("expiryDate").textContent =
      formatDate(membershipEndDate);
    document.getElementById(
      "remainingDays"
    ).textContent = `${remainingDays} days`;
    document.getElementById("nextPaymentDue").textContent =
      formatDate(membershipEndDate);

    // Initialize calendar first (with empty check-ins)
    initializeCalendar(membershipStartDate, membershipEndDate, []);

    // Then fetch check-in data and update calendar
    await loadCheckinData(membership);
  }

  async function displayExpiredMembership(membership) {
    console.log("Displaying expired membership:", membership);

    // Hide pending section
    document.getElementById("pendingMembership").style.display = "none";

    // Show details, calendar and action section
    document.querySelector(".status-details").style.display = "block";
    document.getElementById("noMembership").style.display = "block";

    // Expired header state
    updateStatusHeader("Expired", membership.planType || "None");

    const membershipStartDate = membership.startDate
      ? new Date(membership.startDate)
      : null;
    const membershipEndDate = membership.endDate
      ? new Date(membership.endDate)
      : null;

    document.getElementById("startDate").textContent =
      membershipStartDate && !isNaN(membershipStartDate.getTime())
        ? formatDate(membershipStartDate)
        : "Not set";
    document.getElementById("expiryDate").textContent =
      membershipEndDate && !isNaN(membershipEndDate.getTime())
        ? formatDate(membershipEndDate)
        : "Not set";
    document.getElementById("remainingDays").textContent = "Expired";
    document.getElementById("nextPaymentDue").textContent = "Renew now";
    document.getElementById("lastVisit").textContent = "No visits yet";

    // Show past membership period in calendar
    if (membershipStartDate && membershipEndDate) {
      initializeCalendar(membershipStartDate, membershipEndDate, []);
      document.getElementById("calendarSection").classList.add("calendar-expired");
    }

    // Emphasize renew action with clear inactive indication
    const noMembershipSection = document.getElementById("noMembership");
    const sectionTitle = noMembershipSection.querySelector("h3");
    const sectionMessage = noMembershipSection.querySelector("p");
    const actionButton = noMembershipSection.querySelector("a.btn");

    if (sectionTitle) {
      sectionTitle.textContent = "Membership Expired";
    }
    if (sectionMessage) {
      sectionMessage.textContent =
        "Your membership is no longer active. Renew to continue gym access.";
    }
    if (actionButton) {
      actionButton.textContent = "Renew Membership";
      actionButton.classList.remove("btn-primary");
      actionButton.classList.add("btn-danger", "renew-emphasis");
    }

    // Try to load check-ins for this expired membership too
    await loadCheckinData(membership);
  }

  async function loadCheckinData(membership) {
    try {
      const membershipId = membership._id;
      console.log("🔍 Fetching check-ins for membership:", membershipId);

      // Fetch check-in data for this membership
      const checkinResponse = await fetch(
        `/api/membership/checkins/${membershipId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("📡 Check-in API response status:", checkinResponse.status);

      if (checkinResponse.ok) {
        const checkinResult = await checkinResponse.json();
        console.log("📊 Check-in API result:", checkinResult);

        if (checkinResult.success && checkinResult.checkins) {
          const checkinDates = checkinResult.checkins.map(
            (checkin) => checkin.checkinTime
          );
          console.log("📅 Check-in dates found:", checkinDates);

          // Update calendar with check-in data if calendar exists
          if (membershipCalendar) {
            console.log("🔄 Updating calendar with check-in data");
            membershipCalendar.updateCheckins(checkinDates);
          }

          // Update last visit with most recent check-in
          updateLastVisit(checkinResult.checkins);
        } else {
          // No check-ins found
          console.log("❌ No check-ins found for this membership");
          document.getElementById("lastVisit").textContent = "No visits yet";

          // Initialize calendar without check-in data
          if (membershipCalendar) {
            membershipCalendar.updateCheckins([]);
          }
        }
      } else {
        console.log("❌ Check-in API request failed");
        document.getElementById("lastVisit").textContent = "No visits yet";
      }
    } catch (error) {
      console.error("❌ Error loading check-in data:", error);
      document.getElementById("lastVisit").textContent = "Error loading data";
    }
  }

  function updateLastVisit(checkins) {
    if (!checkins || checkins.length === 0) {
      document.getElementById("lastVisit").textContent = "No visits yet";
      return;
    }

    // Sort check-ins by date (newest first) and get the most recent
    const sortedCheckins = checkins.sort(
      (a, b) => new Date(b.checkinTime) - new Date(a.checkinTime)
    );
    const lastCheckin = sortedCheckins[0];

    const lastVisitDate = new Date(lastCheckin.checkinTime);
    document.getElementById("lastVisit").textContent =
      formatDate(lastVisitDate);
  }

  function displayPendingMembership(membership) {
    console.log("Displaying pending membership:", membership);

    // Hide other sections
    document.querySelector(".status-details").style.display = "none";
    document.getElementById("noMembership").style.display = "none";
    document.getElementById("calendarSection").style.display = "none";
    document.getElementById("calendarSection").classList.remove("calendar-expired");
    resetNoMembershipSection();

    // Show pending section
    document.getElementById("pendingMembership").style.display = "block";

    // Update status pill and plan type badge for pending
    updateStatusHeader("Pending", membership.planType);

    // Update pending details
    document.getElementById("pendingPlan").textContent = membership.planType;
    document.getElementById("pendingDate").textContent = formatDate(
      new Date(membership.appliedAt)
    );

    // Show projected dates if available
    if (membership.startDate && membership.endDate) {
      const startDate = new Date(membership.startDate);
      const endDate = new Date(membership.endDate);

      const projectedDetails = document.createElement("div");
      projectedDetails.className = "pending-details mt-3";
      projectedDetails.innerHTML = `
                <p><strong>Projected Start:</strong> ${formatDate(
                  startDate
                )}</p>
                <p><strong>Projected End:</strong> ${formatDate(endDate)}</p>
                <p><em>Dates will be confirmed upon approval</em></p>
            `;
      document
        .getElementById("pendingMembership")
        .appendChild(projectedDetails);
    }
  }

  function displayNoMembership() {
    // Hide other sections
    document.querySelector(".status-details").style.display = "none";
    document.getElementById("pendingMembership").style.display = "none";
    document.getElementById("calendarSection").style.display = "none";
    document.getElementById("calendarSection").classList.remove("calendar-expired");
    resetNoMembershipSection();

    // Show no membership section
    document.getElementById("noMembership").style.display = "block";

    // Update header for no membership
    updateStatusHeader("No Membership", "None");
  }

  function resetNoMembershipSection() {
    const noMembershipSection = document.getElementById("noMembership");
    const sectionTitle = noMembershipSection.querySelector("h3");
    const sectionMessage = noMembershipSection.querySelector("p");
    const actionButton = noMembershipSection.querySelector("a.btn");

    if (sectionTitle) {
      sectionTitle.textContent = "No Active Membership";
    }
    if (sectionMessage) {
      sectionMessage.textContent = "You don't have an active membership yet.";
    }
    if (actionButton) {
      actionButton.textContent = "Get Membership";
      actionButton.classList.remove("btn-danger", "renew-emphasis");
      actionButton.classList.add("btn-primary");
    }
  }

  function findMostRecentExpiredMembership(memberships) {
    const now = new Date();

    const expiredMemberships = memberships.filter((membership) => {
      if (!membership) return false;

      if (
        typeof membership.status === "string" &&
        membership.status.toLowerCase() === "expired"
      ) {
        return true;
      }

      if (!membership.endDate) {
        return false;
      }

      const endDate = new Date(membership.endDate);
      return !isNaN(endDate.getTime()) && endDate < now;
    });

    if (expiredMemberships.length === 0) {
      return null;
    }

    expiredMemberships.sort((a, b) => {
      const aDate = a.endDate ? new Date(a.endDate).getTime() : 0;
      const bDate = b.endDate ? new Date(b.endDate).getTime() : 0;
      return bDate - aDate;
    });

    return expiredMemberships[0];
  }

  function updateStatusHeader(status, planType) {
    // Update status pill
    const statusPill = document.getElementById("statusPill");
    const statusText = document.getElementById("statusText");

    statusText.textContent = status;

    // Set status pill color
    statusPill.className = "status-pill";
    if (status === "Active") {
      statusPill.classList.add("status-active");
    } else if (status === "Expired") {
      statusPill.classList.add("status-expired");
    } else if (status === "Pending") {
      statusPill.classList.add("status-pending");
    } else {
      statusPill.classList.add("status-none");
    }

    // Update plan type badge
    const planTypeBadge = document.getElementById("planTypeBadge");
    const planTypeText = document.getElementById("planTypeText");

    planTypeText.textContent = planType;

    // Set plan type badge color
    planTypeBadge.className = "plan-type-badge";
    if (planType === "Basic") {
      planTypeBadge.classList.add("plan-basic");
    } else if (planType === "Premium") {
      planTypeBadge.classList.add("plan-premium");
    } else if (planType === "VIP") {
      planTypeBadge.classList.add("plan-vip");
    } else {
      planTypeBadge.classList.add("plan-none");
    }
  }

  function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
      return "Not set";
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function initializeCalendar(startDate, endDate, checkinDates = []) {
    // Show calendar section
    document.getElementById("calendarSection").style.display = "block";

    console.log("📅 Initializing calendar with:", {
      startDate: startDate,
      endDate: endDate,
      checkinDates: checkinDates,
    });

    // Initialize calendar component
    if (membershipCalendar) {
      membershipCalendar.updateDates(startDate, endDate);
      membershipCalendar.updateCheckins(checkinDates);
    } else {
      membershipCalendar = new MembershipCalendar("calendarSection", {
        startDate: startDate,
        endDate: endDate,
        checkinDates: checkinDates, // Pass check-in dates initially
        onDateClick: function (date) {
          console.log("Date clicked:", date);
        },
      });
    }
  }
});
