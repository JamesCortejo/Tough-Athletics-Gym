document.addEventListener("DOMContentLoaded", function () {
  loadUserProfile();
  setupEventListeners();
});

const PROFILE_IMAGE_ALLOWED_EXTENSIONS = ".jpg, .jpeg, .png, .gif, .webp, .svg";
const PROFILE_IMAGE_MAX_SIZE_MB = 10;
const PROFILE_IMAGE_REQUIREMENTS_MESSAGE =
  `Accepted file types: ${PROFILE_IMAGE_ALLOWED_EXTENSIONS}. Maximum file size: ${PROFILE_IMAGE_MAX_SIZE_MB}MB.`;

function loadUserProfile() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const token = localStorage.getItem("token");

  if (currentUser && token) {
    console.log("Loading user profile:", currentUser);

    // Populate form with current user data
    document.getElementById("fname").value = currentUser.firstName || "";
    document.getElementById("lname").value = currentUser.lastName || "";
    document.getElementById("email").value = currentUser.email || "";
    document.getElementById("age").value = currentUser.age || "";
    document.getElementById("gender").value =
      currentUser.gender || "prefer-not-to-say";

    // Update profile display
    document.getElementById("profileName").textContent =
      `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
      "Firstname Lastname";
    document.getElementById("profileEmail").textContent =
      currentUser.email || "User23@gmail.com";

    // Set profile picture
    if (currentUser.profilePicture) {
      document.getElementById("profileImage").src = currentUser.profilePicture;
    } else {
      // Set default profile picture
      document.getElementById("profileImage").src =
        "/images/pfpImages/defaultPfp.png";
    }
  } else {
    console.log("No user data found in localStorage");
    showAlert("Please log in to view your profile", "warning");
  }
}

function setupEventListeners() {
  // Profile picture upload
  document
    .getElementById("profileImageInput")
    .addEventListener("change", function (e) {
      if (e.target.files.length > 0) {
        validateAndUploadProfilePicture(e.target.files[0]);
      }
    });

  // Save button click
  document.getElementById("saveBtn").addEventListener("click", function () {
    if (validateForm()) {
      document.getElementById("popupOverlay").style.display = "flex";
    }
  });

  // Popup buttons
  document.getElementById("noBtn").addEventListener("click", function () {
    document.getElementById("popupOverlay").style.display = "none";
  });

  document.getElementById("yesBtn").addEventListener("click", function () {
    document.getElementById("popupOverlay").style.display = "none";
    updateProfile();
  });

  // Add real-time validation
  addRealTimeValidation();
}

function addRealTimeValidation() {
  // Real-time validation for first name
  document.getElementById("fname").addEventListener("input", function (e) {
    validateFirstNameField(e.target);
  });

  // Real-time validation for last name
  document.getElementById("lname").addEventListener("input", function (e) {
    validateLastNameField(e.target);
  });

  // Real-time validation for email
  document.getElementById("email").addEventListener("input", function (e) {
    validateEmailField(e.target);
  });

  // Real-time validation for age
  document.getElementById("age").addEventListener("input", function (e) {
    validateAgeField(e.target);
  });

  // Real-time validation for age on blur (when user leaves the field)
  document.getElementById("age").addEventListener("blur", function (e) {
    validateAgeField(e.target);
  });
}

// Field validation function
function validateField(field, fieldName) {
  if (!field.value.trim()) {
    showFieldError(field, `${fieldName} is required`);
    return false;
  } else {
    showFieldValid(field);
    return true;
  }
}

// Email validation function
function validateEmailField(field) {
  const email = field.value.trim();
  if (!email) {
    showFieldError(field, "Email is required");
    return false;
  } else if (!isValidEmail(email)) {
    showFieldError(field, "Please enter a valid email address");
    return false;
  } else {
    showFieldValid(field);
    return true;
  }
}

function validateFirstNameField(field) {
  const firstName = field.value.trim();
  if (!firstName) {
    showFieldError(field, "First name is required");
    return false;
  }

  if (!/^[A-Za-z\s-]+$/.test(firstName)) {
    showFieldError(
      field,
      "First name must contain only letters, spaces, and hyphens",
    );
    return false;
  }

  if (firstName.length < 2 || firstName.length > 50) {
    showFieldError(field, "First name must be between 2 and 50 characters");
    return false;
  }

  showFieldValid(field);
  return true;
}

function validateLastNameField(field) {
  const lastName = field.value.trim();
  if (!lastName) {
    showFieldError(field, "Last name is required");
    return false;
  }

  if (!/^[A-Za-z\s-]+$/.test(lastName)) {
    showFieldError(
      field,
      "Last name must contain only letters, spaces, and hyphens",
    );
    return false;
  }

  if (lastName.length < 2 || lastName.length > 50) {
    showFieldError(field, "Last name must be between 2 and 50 characters");
    return false;
  }

  showFieldValid(field);
  return true;
}

// Age validation function
function validateAgeField(field) {
  const age = field.value.trim();
  const ageError = getAgeValidationError(age);
  if (ageError) {
    showFieldError(field, ageError);
    return false;
  } else {
    if (age) {
      showFieldValid(field);
    } else {
      clearFieldError(field);
    }
    return true;
  }
}

function showFieldValid(field) {
  clearFieldError(field);
  field.classList.add("is-valid");
}

// Show field-specific error
function showFieldError(field, message) {
  // Remove existing error message
  clearFieldError(field);

  // Add error class to input
  field.classList.add("is-invalid");

  // Create error message element
  const errorDiv = document.createElement("div");
  errorDiv.className = "invalid-feedback";
  errorDiv.textContent = message;
  errorDiv.id = `${field.id}Error`;

  // Insert error message after the field
  field.parentNode.appendChild(errorDiv);
}

// Clear field error
function clearFieldError(field) {
  field.classList.remove("is-invalid");
  field.classList.remove("is-valid");

  const errorElement = document.getElementById(`${field.id}Error`);
  if (errorElement) {
    errorElement.remove();
  }
}

// Validate profile picture before upload
function validateAndUploadProfilePicture(file) {
  // Clear any previous alerts
  clearAlerts();

  // Check if file exists
  if (!file) {
    showAlert("Please select a file", "danger");
    return;
  }

  // Check file type
  const validImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (!validImageTypes.includes(file.type)) {
    showAlert(
      `Invalid file type. ${PROFILE_IMAGE_REQUIREMENTS_MESSAGE}`,
      "danger",
    );
    // Reset the file input
    document.getElementById("profileImageInput").value = "";
    return;
  }

  // Check file size (10MB = 10 * 1024 * 1024 bytes)
  const maxSize = PROFILE_IMAGE_MAX_SIZE_MB * 1024 * 1024;
  if (file.size > maxSize) {
    showAlert(
      `File is too large. ${PROFILE_IMAGE_REQUIREMENTS_MESSAGE}`,
      "danger",
    );
    // Reset the file input
    document.getElementById("profileImageInput").value = "";
    return;
  }

  // Check image dimensions (optional but good practice)
  const img = new Image();
  img.onload = function () {
    // You can add dimension validation here if needed
    // For example: if (this.width > 2048 || this.height > 2048) {...}

    // If all validations pass, upload the file
    showAlert("Uploading profile picture...", "info");
    uploadProfilePicture(file);
  };

  img.onerror = function () {
    showAlert("Invalid image file. Please select a valid image.", "danger");
    document.getElementById("profileImageInput").value = "";
  };

  img.src = URL.createObjectURL(file);
}

function uploadProfilePicture(file) {
  const formData = new FormData();
  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!currentUser || !currentUser._id) {
    showAlert("Please log in to update profile picture", "danger");
    return;
  }

  formData.append("profilePicture", file);
  formData.append("userId", currentUser._id);

  fetch("/profile/picture", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })
    .then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const serverMessage = result && result.message ? result.message : `Server responded with ${response.status}`;
        throw new Error(serverMessage);
      }
      return result;
    })
    .then((result) => {
      if (result.success) {
        // Update profile image
        document.getElementById("profileImage").src = result.profilePicture;

        // Update localStorage
        const updatedUser = { ...currentUser, ...result.user };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));

        showAlert("Profile picture updated successfully!", "success");
      } else {
        showAlert("Error: " + result.message, "danger");
      }
    })
    .catch((error) => {
      console.error("Error uploading profile picture:", error);
      showAlert("Error uploading profile picture: " + error.message, "danger");
    })
    .finally(() => {
      // Reset the file input
      document.getElementById("profileImageInput").value = "";
    });
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate age
function validateAge(age) {
  return !getAgeValidationError(age);
}

function getAgeValidationError(age) {
  const ageText = String(age || "").trim();

  if (!ageText) {
    return null;
  }

  if (!/^\d+$/.test(ageText)) {
    if (/^\d+\.\d+$/.test(ageText)) {
      return "Age must be a whole number (no decimals)";
    }
    return "Age must contain numbers only";
  }

  const ageNum = Number(ageText);
  if (!Number.isInteger(ageNum) || ageNum < 16 || ageNum > 100) {
    return "Age must be between 16 and 100";
  }

  return null;
}

// Comprehensive form validation
function validateForm() {
  let isValid = true;

  // Clear all previous errors
  clearAllFieldErrors();

  // Validate first name
  if (!validateFirstNameField(document.getElementById("fname"))) {
    isValid = false;
  }

  // Validate last name
  if (!validateLastNameField(document.getElementById("lname"))) {
    isValid = false;
  }

  // Validate email
  if (!validateEmailField(document.getElementById("email"))) {
    isValid = false;
  }

  // Validate age
  const ageField = document.getElementById("age");
  const age = ageField.value.trim();
  const ageError = getAgeValidationError(age);
  if (ageError) {
    showFieldError(ageField, ageError);
    isValid = false;
  }

  return isValid;
}

// Clear all field errors
function clearAllFieldErrors() {
  const fields = ["fname", "lname", "email", "age"];
  fields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      clearFieldError(field);
    }
  });
}

// Clear all alerts
function clearAlerts() {
  const alertContainer = document.getElementById("alertContainer");
  if (alertContainer) {
    alertContainer.innerHTML = "";
  }
}

function updateProfile() {
  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!currentUser) {
    showAlert("Please log in to update profile", "danger");
    return;
  }

  const profileData = {
    firstName: document.getElementById("fname").value.trim(),
    lastName: document.getElementById("lname").value.trim(),
    email: document.getElementById("email").value.trim(),
    age: document.getElementById("age").value,
    gender: document.getElementById("gender").value,
  };

  // Re-validate form before sending
  if (!validateForm()) {
    showAlert("Please fix the errors in the form before saving.", "danger");
    return;
  }

  showAlert("Updating profile...", "info");

  fetch("/profile/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => ({
        success: false,
        message: `Server responded with ${response.status}`,
      }));
      return result;
    })
    .then((result) => {
      if (result.success) {
        // Update localStorage
        const updatedUser = { ...currentUser, ...result.user };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));

        // Update display
        document.getElementById("profileName").textContent =
          `${result.user.firstName} ${result.user.lastName}`;
        document.getElementById("profileEmail").textContent = result.user.email;

        // Mark fields as valid
        document.getElementById("fname").classList.add("is-valid");
        document.getElementById("lname").classList.add("is-valid");
        document.getElementById("email").classList.add("is-valid");
        if (profileData.age) {
          document.getElementById("age").classList.add("is-valid");
        }

        showAlert("Profile updated successfully!", "success");
      } else {
        // Handle specific error cases
        if (
          result.message.includes("Email is already taken") ||
          result.message.startsWith('Email: "')
        ) {
          showFieldError(
            document.getElementById("email"),
            "This email is already registered to another account",
          );
          showAlert("Cannot save: " + result.message, "danger");
        } else if (result.message.includes("Age must be between 16 and 100")) {
          showFieldError(
            document.getElementById("age"),
            "Age must be between 16 and 100",
          );
          showAlert("Cannot save: " + result.message, "danger");
        } else {
          showAlert("Error: " + result.message, "danger");
        }
      }
    })
    .catch((error) => {
      console.error("Error updating profile:", error);
      showAlert("Error updating profile: " + error.message, "danger");
    });
}

function showAlert(message, type) {
  const alertContainer = document.getElementById("alertContainer");

  // Clear existing alerts
  clearAlerts();

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
