// public/js/login.js
document.addEventListener("DOMContentLoaded", function () {
  let recaptchaSiteKey = "";
  const loginForm = document.querySelector("form");
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 10;
  const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;

  // Helper functions for local storage
  function getLoginAttempts(username) {
    const attemptsData = JSON.parse(
      localStorage.getItem("loginAttempts") || "{}",
    );
    return (
      attemptsData[username] || {
        count: 0,
        lockedUntil: null,
        lastAttempt: null,
      }
    );
  }

  function updateLoginAttempts(username, isSuccess) {
    const attemptsData = JSON.parse(
      localStorage.getItem("loginAttempts") || "{}",
    );

    if (!attemptsData[username]) {
      attemptsData[username] = {
        count: 0,
        lockedUntil: null,
        lastAttempt: null,
      };
    }

    const now = Date.now();

    if (isSuccess) {
      // Reset on successful login
      attemptsData[username] = {
        count: 0,
        lockedUntil: null,
        lastAttempt: now,
      };
    } else {
      // Increment failed attempts
      const currentCount = attemptsData[username].count;
      const newCount = currentCount + 1;

      if (newCount >= MAX_ATTEMPTS) {
        // Lock for 10 minutes
        attemptsData[username] = {
          count: newCount,
          lockedUntil: now + LOCKOUT_MS,
          lastAttempt: now,
        };
      } else {
        attemptsData[username] = {
          count: newCount,
          lockedUntil: null,
          lastAttempt: now,
        };
      }
    }

    localStorage.setItem("loginAttempts", JSON.stringify(attemptsData));
    return attemptsData[username];
  }

  function isAccountLocked(username) {
    const attempts = getLoginAttempts(username);

    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
      return {
        isLocked: true,
        remainingTime: attempts.lockedUntil - Date.now(),
        attempts: attempts.count,
        lockEndTime: attempts.lockedUntil,
      };
    }

    // Auto-reset if lock time has passed
    if (attempts.lockedUntil && attempts.lockedUntil <= Date.now()) {
      updateLoginAttempts(username, true); // Reset
      return {
        isLocked: false,
        remainingTime: 0,
        attempts: 0,
        lockEndTime: null,
      };
    }

    return {
      isLocked: false,
      remainingTime: 0,
      attempts: attempts.count,
      lockEndTime: null,
    };
  }

  function getRemainingAttempts(username) {
    const attempts = getLoginAttempts(username);
    return Math.max(0, MAX_ATTEMPTS - attempts.count);
  }

  // NEW: Store active countdown state
  function storeCountdownState(username, remainingTime) {
    const countdownState = {
      username: username,
      remainingTime: remainingTime,
      timestamp: Date.now(),
      lockEndTime: Date.now() + remainingTime,
    };
    localStorage.setItem("activeCountdown", JSON.stringify(countdownState));
  }

  // NEW: Get stored countdown state
  function getCountdownState() {
    const state = JSON.parse(localStorage.getItem("activeCountdown") || "{}");

    // Validate state
    if (!state.username || !state.lockEndTime) {
      return null;
    }

    // Check if countdown is still valid (not expired and matches current user)
    const currentRemaining = state.lockEndTime - Date.now();
    if (currentRemaining <= 0) {
      localStorage.removeItem("activeCountdown");
      return null;
    }

    return {
      username: state.username,
      remainingTime: currentRemaining,
      lockEndTime: state.lockEndTime,
    };
  }

  // NEW: Clear countdown state
  function clearCountdownState() {
    localStorage.removeItem("activeCountdown");
  }

  function showLockoutMessage(remainingTime, username) {
    const minutes = Math.ceil(remainingTime / (60 * 1000));
    const seconds = Math.ceil((remainingTime % (60 * 1000)) / 1000);

    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.id = "lockCountdownAlert";
    alertDiv.className =
      "alert alert-warning alert-dismissible fade show lock-alert";
    alertDiv.style.cssText = "margin: 10px 0; width: 100%; max-width: 100%;";
    alertDiv.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi bi-shield-lock me-2" style="font-size: 1.2em;"></i>
        <div>
          <strong>Account Locked!</strong><br>
          Too many failed login attempts. Please try again in 
          <span class="countdown-timer" id="countdownDisplay">${minutes}:${seconds.toString().padStart(2, "0")}</span>
        </div>
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    if (formContainer) {
      const form = formContainer.querySelector("form");
      if (form) {
        formContainer.insertBefore(alertDiv, form);

        // Disable form inputs
        form.querySelectorAll("input, button").forEach((element) => {
          element.disabled = true;
        });

        // Start countdown and store state
        startCountdown(remainingTime, alertDiv, form, username);

        // Store countdown state
        storeCountdownState(username, remainingTime);
      }
    }

    return alertDiv;
  }

  function startCountdown(remainingTime, alertDiv, form, username) {
    const countdownElement = alertDiv.querySelector("#countdownDisplay");
    let timeLeft = remainingTime;

    const countdownInterval = setInterval(() => {
      timeLeft -= 1000;

      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        clearCountdownState();

        alertDiv.innerHTML = `
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <i class="bi bi-check-circle me-2" style="color: #198754;"></i>
              <strong>Account Unlocked!</strong> You can now try logging in again.
            </div>
            <button class="btn btn-sm btn-success" onclick="location.reload()">Try Again</button>
          </div>
        `;

        // Re-enable form
        form.querySelectorAll("input, button").forEach((element) => {
          element.disabled = false;
        });

        // Reset attempts for this user
        updateLoginAttempts(username, true);
        return;
      }

      const minutes = Math.floor(timeLeft / (60 * 1000));
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
      countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      // Update stored countdown state
      storeCountdownState(username, timeLeft);
    }, 1000);

    // Store interval ID for cleanup
    alertDiv.dataset.intervalId = countdownInterval;
  }

  // NEW: Restore countdown on page load
  function restoreCountdownOnLoad() {
    const countdownState = getCountdownState();

    if (countdownState) {
      const usernameInput = document.getElementById("username");

      // Check if username matches the locked account
      if (
        usernameInput &&
        usernameInput.value.trim() === countdownState.username
      ) {
        // Show lockout message with stored time
        setTimeout(() => {
          showLockoutMessage(
            countdownState.remainingTime,
            countdownState.username,
          );
        }, 100);
        return true;
      } else if (usernameInput && !usernameInput.value.trim()) {
        // If username field is empty, check if we should show a general lock warning
        const attemptsData = JSON.parse(
          localStorage.getItem("loginAttempts") || "{}",
        );
        const lockedUsers = Object.entries(attemptsData)
          .filter(
            ([user, data]) => data.lockedUntil && data.lockedUntil > Date.now(),
          )
          .map(([user]) => user);

        if (lockedUsers.length > 0) {
          // Show a general warning that some account is locked on this device
          showGeneralLockWarning(lockedUsers);
        }
      }
    }
    return false;
  }

  // NEW: Show general lock warning
  function showGeneralLockWarning(lockedUsers) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-info alert-dismissible fade show";
    alertDiv.style.cssText = "margin: 10px 0; width: 100%; max-width: 100%;";

    let message = "";
    if (lockedUsers.length === 1) {
      message = `<strong>Note:</strong> Account "${lockedUsers[0]}" is currently locked on this device.`;
    } else {
      message = `<strong>Note:</strong> Multiple accounts are locked on this device.`;
    }

    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    if (formContainer) {
      const form = formContainer.querySelector("form");
      if (form) {
        formContainer.insertBefore(alertDiv, form);
      }
    }
  }

  // Update showError to include attempt tracking
  function showError(message, username = null) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-danger alert-dismissible fade show";
    alertDiv.style.cssText = "margin: 10px 0; width: 100%; max-width: 100%;";

    let displayMessage = message;

    // Add attempts remaining if username provided
    if (username) {
      const remainingAttempts = getRemainingAttempts(username);
      if (remainingAttempts > 0 && remainingAttempts < MAX_ATTEMPTS) {
        displayMessage += `<br><small class="attempts-warning">${remainingAttempts} attempt(s) remaining before lockout.</small>`;
      }
    }

    alertDiv.innerHTML = `
      ${displayMessage}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    if (formContainer) {
      const form = formContainer.querySelector("form");
      if (form) {
        formContainer.insertBefore(alertDiv, form);
      } else {
        formContainer.appendChild(alertDiv);
      }
    }
  }

  function showSuccess(message) {
    removeExistingAlerts();

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-success alert-dismissible fade show";
    alertDiv.style.cssText = "margin: 10px 0; width: 100%; max-width: 100%;";
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const formContainer = document.querySelector(".formContainer");
    if (formContainer) {
      const form = formContainer.querySelector("form");
      if (form) {
        formContainer.insertBefore(alertDiv, form);
      } else {
        formContainer.appendChild(alertDiv);
      }
    }
  }

  function removeExistingAlerts() {
    const existingAlerts = document.querySelectorAll(
      ".alert:not(#registrationSuccessAlert)",
    );
    existingAlerts.forEach((alert) => {
      // Clear any countdown intervals
      if (alert.dataset.intervalId) {
        clearInterval(parseInt(alert.dataset.intervalId));
      }
      alert.remove();
    });
  }

  // Load reCAPTCHA configuration
  async function loadRecaptchaConfig() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      recaptchaSiteKey = config.recaptchaSiteKey;

      // Load reCAPTCHA script
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
      document.head.appendChild(script);
    } catch (error) {
      console.error("Failed to load reCAPTCHA config:", error);
      showError(
        "Security verification failed to load. Please refresh the page.",
      );
    }
  }

  // Function to get reCAPTCHA token
  async function getRecaptchaToken() {
    return new Promise((resolve) => {
      if (typeof grecaptcha === "undefined") {
        console.error("reCAPTCHA not loaded");
        resolve(null);
        return;
      }

      if (!recaptchaSiteKey) {
        console.error("reCAPTCHA site key not available");
        resolve(null);
        return;
      }

      grecaptcha.ready(function () {
        grecaptcha
          .execute(recaptchaSiteKey, { action: "login" })
          .then(function (token) {
            console.log("reCAPTCHA token obtained:", token);
            resolve(token);
          })
          .catch(function (error) {
            console.error("reCAPTCHA error:", error);
            resolve(null);
          });
      });
    });
  }

  // Check for locked accounts on page load
  function checkStoredLocks() {
    const usernameInput = document.getElementById("username");
    if (usernameInput && usernameInput.value) {
      const lockStatus = isAccountLocked(usernameInput.value);
      if (lockStatus.isLocked) {
        showLockoutMessage(lockStatus.remainingTime, usernameInput.value);
        return true;
      }
    }
    return false;
  }

  // Real-time lock checking as user types
  const usernameInput = document.getElementById("username");
  if (usernameInput) {
    usernameInput.addEventListener("blur", function () {
      const username = this.value.trim();
      if (username) {
        const lockStatus = isAccountLocked(username);
        if (lockStatus.isLocked) {
          showLockoutMessage(lockStatus.remainingTime, username);
        }
      }
    });

    // NEW: Clear stored countdown if username changes
    usernameInput.addEventListener("input", function () {
      const username = this.value.trim();
      const countdownState = getCountdownState();

      if (countdownState && countdownState.username !== username) {
        // Clear the countdown display but keep the lock in storage
        const lockAlert = document.getElementById("lockCountdownAlert");
        if (lockAlert) {
          lockAlert.remove();
        }

        // Re-enable form if it was disabled
        const form = document.querySelector("form");
        if (form) {
          form.querySelectorAll("input, button").forEach((element) => {
            element.disabled = false;
          });
        }
      }
    });
  }

  // NEW: Check and restore countdown on page load
  function initializePage() {
    // First, try to restore any active countdown
    const countdownRestored = restoreCountdownOnLoad();

    // If no countdown was restored, check for regular locks
    if (!countdownRestored) {
      setTimeout(checkStoredLocks, 500);
    }

    // Clean up old lock data
    cleanupOldLocks();
  }

  // Run initialization on page load
  initializePage();

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();

      // Check if account is locked
      const lockStatus = isAccountLocked(username);
      if (lockStatus.isLocked) {
        showLockoutMessage(lockStatus.remainingTime, username);
        return;
      }

      // Show loading state
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Verifying...";
      submitBtn.disabled = true;

      try {
        // Wait a moment for reCAPTCHA to be ready if needed
        if (typeof grecaptcha === "undefined") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken();

        if (!recaptchaToken) {
          showError(
            "Security verification failed. Please refresh the page and try again.",
          );
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        // Get form data
        const formData = {
          username: username,
          password: document.getElementById("password").value,
          recaptchaToken: recaptchaToken,
        };

        // Client-side validation
        if (!formData.username || !formData.password) {
          showError("Username and password are required!");
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          return;
        }

        console.log("Sending login request with reCAPTCHA");

        const response = await fetch("/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();
        console.log("Login response:", result);

        if (result.success) {
          // Successful login - reset attempts and clear countdown
          updateLoginAttempts(username, true);
          clearCountdownState();

          // Store JWT token and user data in localStorage
          localStorage.setItem("token", result.token);

          // FIX: Ensure all user data including authMethod is stored
          const userData = {
            ...result.user,
            // Ensure authMethod is included in stored user data
            authMethod: result.user.authMethod || "local",
          };
          localStorage.setItem("currentUser", JSON.stringify(userData));

          console.log("Stored user data:", userData);
          console.log("User authMethod:", userData.authMethod);

          showSuccess(result.message);
          console.log("Redirecting to:", result.redirect);

          // Redirect immediately
          window.location.href = result.redirect;
        } else {
          // Failed login - update attempts
          updateLoginAttempts(username, false);

          // Check if account is now locked
          const newLockStatus = isAccountLocked(username);

          if (newLockStatus.isLocked) {
            showLockoutMessage(newLockStatus.remainingTime, username);
          } else {
            showError("Login failed: " + result.message, username);
          }

          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        console.error("Error:", error);
        showError(
          "An error occurred during login. Please try again.",
          username,
        );
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Clean up old lock data (older than 24 hours)
  function cleanupOldLocks() {
    const attemptsData = JSON.parse(
      localStorage.getItem("loginAttempts") || "{}",
    );
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    let cleaned = false;
    for (const [username, data] of Object.entries(attemptsData)) {
      if (data.lastAttempt && data.lastAttempt < twentyFourHoursAgo) {
        delete attemptsData[username];
        cleaned = true;
      }
    }

    if (cleaned) {
      localStorage.setItem("loginAttempts", JSON.stringify(attemptsData));
    }

    // Also clean up old countdown state
    const countdownState = getCountdownState();
    if (
      countdownState &&
      countdownState.lockEndTime &&
      countdownState.lockEndTime < now
    ) {
      clearCountdownState();
    }
  }

  // Initialize reCAPTCHA
  loadRecaptchaConfig();

  // NEW: Handle page visibility changes
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      // Page became visible again, check if we need to restore countdown
      const countdownState = getCountdownState();
      if (countdownState) {
        const usernameInput = document.getElementById("username");
        if (
          usernameInput &&
          usernameInput.value.trim() === countdownState.username
        ) {
          // Remove existing alert and create new one
          const existingAlert = document.getElementById("lockCountdownAlert");
          if (existingAlert) {
            existingAlert.remove();
          }
          showLockoutMessage(
            countdownState.remainingTime,
            countdownState.username,
          );
        }
      }
    }
  });

  // NEW: Handle page unload to store state
  window.addEventListener("beforeunload", function () {
    const countdownAlert = document.getElementById("lockCountdownAlert");
    if (countdownAlert) {
      // Get the current countdown time from the display
      const countdownText = document.getElementById("countdownDisplay");
      if (countdownText) {
        const timeParts = countdownText.textContent.split(":");
        if (timeParts.length === 2) {
          const minutes = parseInt(timeParts[0]);
          const seconds = parseInt(timeParts[1]);
          const remainingTime = (minutes * 60 + seconds) * 1000;

          const usernameInput = document.getElementById("username");
          if (usernameInput && usernameInput.value.trim()) {
            storeCountdownState(usernameInput.value.trim(), remainingTime);
          }
        }
      }
    }
  });
});
