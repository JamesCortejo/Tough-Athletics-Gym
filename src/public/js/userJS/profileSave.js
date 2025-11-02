document.addEventListener("DOMContentLoaded", function () {
  loadUserProfile();
  setupEventListeners();
});

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
        uploadProfilePicture(e.target.files[0]);
      }
    });

  // Save button click
  document.getElementById("saveBtn").addEventListener("click", function () {
    document.getElementById("popupOverlay").style.display = "flex";
  });

  // Popup buttons
  document.getElementById("noBtn").addEventListener("click", function () {
    document.getElementById("popupOverlay").style.display = "none";
  });

  document.getElementById("yesBtn").addEventListener("click", function () {
    document.getElementById("popupOverlay").style.display = "none";
    updateProfile();
  });
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

  showAlert("Uploading profile picture...", "info");

  fetch("/profile/picture", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })
    .then((response) => response.json())
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
      showAlert("Error uploading profile picture", "danger");
    });
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

  // Validation
  if (!profileData.firstName || !profileData.lastName || !profileData.email) {
    showAlert("Please fill in all required fields", "danger");
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
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        // Update localStorage
        const updatedUser = { ...currentUser, ...result.user };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));

        // Update display
        document.getElementById(
          "profileName"
        ).textContent = `${result.user.firstName} ${result.user.lastName}`;
        document.getElementById("profileEmail").textContent = result.user.email;

        showAlert("Profile updated successfully!", "success");
      } else {
        showAlert("Error: " + result.message, "danger");
      }
    })
    .catch((error) => {
      console.error("Error updating profile:", error);
      showAlert("Error updating profile", "danger");
    });
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
