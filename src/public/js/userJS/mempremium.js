document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const token = localStorage.getItem("token");

  // Set plan-specific details based on the page
  let planType, planAmount, planDuration;

  if (window.location.pathname.includes("usermembershipbasic")) {
    planType = "Basic";
    planAmount = "500";
    planDuration = "1 Month";
  } else if (window.location.pathname.includes("usermembershippremium")) {
    planType = "Premium";
    planAmount = "1200";
    planDuration = "3 Months";
  } else if (window.location.pathname.includes("usermembershipvip")) {
    planType = "VIP";
    planAmount = "2000";
    planDuration = "6 Months";
  }

  // Update plan information display
  if (document.getElementById("selectedPlan")) {
    document.getElementById("selectedPlan").textContent = planType;
  }
  if (document.getElementById("planAmount")) {
    document.getElementById("planAmount").textContent = planAmount;
  }
  if (document.getElementById("planDuration")) {
    document.getElementById("planDuration").textContent = planDuration;
  }

  if (!currentUser || !token) {
    alert("Please log in first");
    window.location.href = "/login";
    return;
  }

  // Pre-fill form with user data (readonly)
  if (currentUser) {
    if (document.getElementById("firstname")) {
      document.getElementById("firstname").value = currentUser.firstName || "";
    }
    if (document.getElementById("lastname")) {
      document.getElementById("lastname").value = currentUser.lastName || "";
    }
    if (document.getElementById("email")) {
      document.getElementById("email").value = currentUser.email || "";
    }
    if (document.getElementById("phone")) {
      document.getElementById("phone").value = currentUser.mobile || "";
    }
  }

  // Check membership status and disable form if needed
  async function checkMembershipStatus() {
    try {
      const response = await fetch("/api/membership/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success && result.status) {
        const status = result.status;

        if (status.hasActive) {
          const active = status.activeMembership;
          const endDate = new Date(active.endDate).toLocaleDateString();
          disableForm(
            `You already have an active ${active.planType} membership that ends on ${endDate}. Please wait until your current membership expires before applying for a new one.`
          );
        } else if (status.hasPending) {
          const pending = status.pendingMembership;
          const appliedDate = new Date(pending.appliedAt).toLocaleDateString();
          disableForm(
            `You already have a pending ${pending.planType} membership application submitted on ${appliedDate}. Please wait for admin approval before applying for a new membership.`
          );
        }
      }
    } catch (error) {
      console.error("Error checking membership status:", error);
    }
  }

  function disableForm(message) {
    // Disable all form inputs
    const inputs = form.querySelectorAll("input, button, select");
    inputs.forEach((input) => {
      input.disabled = true;
    });

    // Show warning message
    const warningDiv = document.createElement("div");
    warningDiv.className = "alert alert-warning mt-3";
    warningDiv.innerHTML = `
            <strong>⚠️ Application Blocked</strong>
            <p class="mb-0">${message}</p>
        `;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.parentNode.insertBefore(warningDiv, submitBtn);
    } else {
      form.appendChild(warningDiv);
    }

    // Change submit button to show it's disabled
    if (submitBtn) {
      submitBtn.textContent = "Application Not Available";
      submitBtn.className = "btn btn-secondary mt-4";
      submitBtn.style.width = "100%";
      submitBtn.style.padding = "12px";
      submitBtn.style.fontSize = "18px";
    }
  }

  // Form submit event listener
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked'
    ).value;

    // Update confirmation popup content
    document.getElementById("confirmPlanType").textContent = planType;
    document.getElementById("confirmPlanAmount").textContent = planAmount;
    document.getElementById("confirmPlanDuration").textContent = planDuration;
    document.getElementById("confirmPaymentMethod").textContent = paymentMethod;

    // Show confirmation popup
    showConfirmationPopup();
  });

  // Confirmation Popup Functions
  function showConfirmationPopup() {
    const popup = document.getElementById("confirmationPopup");
    popup.style.display = "flex";
    document.body.classList.add("popup-open");

    // Add event listeners for confirmation buttons
    document.getElementById("confirmSubmitBtn").onclick = handleFormSubmission;
    document.getElementById("cancelConfirmBtn").onclick = hideConfirmationPopup;

    // Close popup when clicking outside
    popup.onclick = function (e) {
      if (e.target === popup) {
        hideConfirmationPopup();
      }
    };

    // Close on escape key
    document.addEventListener("keydown", handleEscapeKey);
  }

  function hideConfirmationPopup() {
    const popup = document.getElementById("confirmationPopup");
    popup.style.display = "none";
    document.body.classList.remove("popup-open");
    document.removeEventListener("keydown", handleEscapeKey);
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape") {
      hideConfirmationPopup();
      hideSuccessPopup();
    }
  }

  async function handleFormSubmission() {
    hideConfirmationPopup();

    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked'
    ).value;

    const formData = {
      planType: planType,
      paymentMethod: paymentMethod,
    };

    try {
      // Show loading state on submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Submitting...";
      submitBtn.disabled = true;

      const response = await fetch("/api/membership/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        showSuccessPopup(result.message);
      } else {
        // Show error message
        const errorPopup = document.getElementById("confirmationPopup");
        const errorHeader = errorPopup.querySelector(".custom-popup-header");
        const errorBody = errorPopup.querySelector(".custom-popup-body");
        const errorFooter = errorPopup.querySelector(".custom-popup-footer");

        errorHeader.innerHTML =
          '<h3 style="color: white;">❌ Application Error</h3>';
        errorHeader.style.background = "#dc3545";
        errorBody.innerHTML = `<p>${result.message}</p>`;
        errorFooter.innerHTML =
          '<button type="button" class="btn btn-primary" id="errorOkBtn" style="width: 100%;">OK</button>';

        errorPopup.style.display = "flex";
        document.getElementById("errorOkBtn").onclick = function () {
          errorPopup.style.display = "none";
          document.body.classList.remove("popup-open");
        };
      }
    } catch (error) {
      console.error("Error:", error);
      // Show error popup for network errors
      const errorPopup = document.getElementById("confirmationPopup");
      const errorHeader = errorPopup.querySelector(".custom-popup-header");
      const errorBody = errorPopup.querySelector(".custom-popup-body");
      const errorFooter = errorPopup.querySelector(".custom-popup-footer");

      errorHeader.innerHTML = '<h3 style="color: white;">❌ Network Error</h3>';
      errorHeader.style.background = "#dc3545";
      errorBody.innerHTML = `<p>An error occurred while submitting your application. Please check your internet connection and try again.</p>`;
      errorFooter.innerHTML =
        '<button type="button" class="btn btn-primary" id="networkErrorOkBtn" style="width: 100%;">OK</button>';

      errorPopup.style.display = "flex";
      document.getElementById("networkErrorOkBtn").onclick = function () {
        errorPopup.style.display = "none";
        document.body.classList.remove("popup-open");
      };
    } finally {
      // Reset button state
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = "Submit Membership Application";
        submitBtn.disabled = false;
      }
    }
  }

  function showSuccessPopup(message) {
    const popup = document.getElementById("successPopup");
    document.getElementById("successMessage").textContent = message;
    popup.style.display = "flex";
    document.body.classList.add("popup-open");

    // Add event listener for OK button
    document.getElementById("successOkBtn").onclick = function () {
      hideSuccessPopup();
      window.location.href = "/userhomepage";
    };

    // Close popup when clicking outside
    popup.onclick = function (e) {
      if (e.target === popup) {
        hideSuccessPopup();
        window.location.href = "/userhomepage";
      }
    };

    // Close on escape key
    document.addEventListener("keydown", handleEscapeKey);
  }

  function hideSuccessPopup() {
    const popup = document.getElementById("successPopup");
    popup.style.display = "none";
    document.body.classList.remove("popup-open");
    document.removeEventListener("keydown", handleEscapeKey);
  }

  // Add some basic form validation
  form.addEventListener("input", function () {
    const requiredFields = form.querySelectorAll("[required]");
    let allValid = true;

    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        allValid = false;
      }
    });

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = !allValid;
    }
  });

  // Payment method change listener to update confirmation popup in real-time
  const paymentMethods = form.querySelectorAll('input[name="paymentMethod"]');
  paymentMethods.forEach((method) => {
    method.addEventListener("change", function () {
      // This will update when the confirmation popup is shown
    });
  });

  // Check membership status when page loads
  checkMembershipStatus();
});
