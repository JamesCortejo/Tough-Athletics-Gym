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

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked'
    ).value;

    const formData = {
      planType: planType,
      paymentMethod: paymentMethod,
    };

    try {
      // Show loading state
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
        alert(
          `✅ ${result.message}\n\nYour application is now pending approval. Please visit the gym to complete your payment and activation.`
        );
        window.location.href = "/userhomepage";
      } else {
        alert("Error: " + result.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while submitting your application");
    } finally {
      // Reset button state
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = "Submit Membership Application";
      submitBtn.disabled = false;
    }
  });

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

  // Check membership status when page loads
  checkMembershipStatus();
});
