// Admin Check-in QR Scanner Functionality
class AdminCheckin {
  constructor() {
    this.html5QrcodeScanner = null;
    this.isScannerActive = false;
    this.adminToken = localStorage.getItem("adminToken");
    this.libraryLoaded = false;
    this.currentMembership = null;
    this.currentQrCode = null;

    // Bind methods to maintain correct 'this' context
    this.performCheckin = this.performCheckin.bind(this);
    this.cancelCheckin = this.cancelCheckin.bind(this);
    this.startQRScanner = this.startQRScanner.bind(this);

    this.init();
  }

  init() {
    this.checkLibraryAvailability();
    this.setupEventListeners();
    this.checkCameraSupport();
    this.updateCheckinStatus("Ready to scan", "status-pending");
  }

  checkLibraryAvailability() {
    // Check if Html5Qrcode library is available
    if (typeof Html5Qrcode === "undefined") {
      console.error(
        "Html5Qrcode library not loaded. Check if the script is properly included."
      );
      this.showAlert(
        "QR Scanner library failed to load. Please refresh the page or use manual QR code input.",
        "danger"
      );
      this.libraryLoaded = false;
      this.disableScanner();
      return false;
    }

    console.log("Html5Qrcode library loaded successfully:", typeof Html5Qrcode);
    this.libraryLoaded = true;
    return true;
  }

  setupEventListeners() {
    // QR Scanner Event Listeners
    const startScannerBtn = document.getElementById("startScannerBtn");
    const stopScannerBtn = document.getElementById("stopScannerBtn");

    if (startScannerBtn) {
      startScannerBtn.addEventListener("click", () => this.startQRScanner());
    }

    if (stopScannerBtn) {
      stopScannerBtn.addEventListener("click", () => this.stopQRScanner());
    }

    // Manual search (replaced manual check-in)
    const manualSearchBtn = document.getElementById("manualSearchBtn");
    const manualQrCodeInput = document.getElementById("manualQrCode");

    if (manualSearchBtn && manualQrCodeInput) {
      manualSearchBtn.addEventListener("click", () => {
        const qrCode = manualQrCodeInput.value.trim();
        if (qrCode) {
          this.processManualSearch(qrCode);
        } else {
          this.showAlert("Please enter a QR code to search", "warning");
        }
      });

      manualQrCodeInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          manualSearchBtn.click();
        }
      });
    }
  }

  // New method for manual search
  async processManualSearch(qrCode) {
    let qrCodeId;
    try {
      // Try to parse as JSON first for manual input too
      const qrData = JSON.parse(qrCode);
      qrCodeId = qrData.qrCodeId;
      console.log("Parsed manual QR data, extracted qrCodeId:", qrCodeId);
    } catch (e) {
      // If it's not JSON, use the raw string
      qrCodeId = qrCode;
      console.log("Using raw manual QR code as ID:", qrCodeId);
    }

    if (!qrCodeId) {
      this.showAlert("Invalid QR code format", "danger");
      return;
    }

    // Set flag to indicate this is a manual entry (not QR scan)
    this.manualEntry = true;
    await this.searchMember(qrCodeId);
  }

  // New method to search for member without checking in
  async searchMember(qrCode) {
    this.updateCheckinStatus("Searching...", "status-active");
    this.showLoading(true);

    try {
      // Validate QR code format
      if (!qrCode || qrCode.trim() === "") {
        throw new Error("Invalid QR code");
      }

      console.log("🔍 Manual search for QR code:", qrCode);

      // Call the same API but we'll handle it differently
      const response = await fetch(
        `/api/membership/checkin/${encodeURIComponent(qrCode)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Search failed");
      }

      const result = await response.json();

      if (result.success) {
        // Display user info with confirmation buttons (same as scan)
        this.displayUserInfo(result.membership, qrCode);
        this.updateCheckinStatus("Member found", "status-pending");
        this.showAlert(
          `Found member: ${result.membership.firstName} ${result.membership.lastName}`,
          "success"
        );
      } else {
        throw new Error(result.message || "Member not found");
      }
    } catch (error) {
      console.error("Search error:", error);
      this.displayError(error.message);
      this.updateCheckinStatus("Search failed", "status-error");
      this.showAlert(`Search failed: ${error.message}`, "danger");
    } finally {
      this.showLoading(false);
    }
  }

  checkCameraSupport() {
    console.log("Checking camera support...");

    // Check for camera API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showAlert(
        "Camera access is not supported in this browser. " +
          "Please ensure you're using a modern browser like Chrome, Firefox, or Edge.",
        "warning"
      );
      return false;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";

    const isSecure = window.location.protocol === "https:" || isLocalhost;

    if (!isSecure) {
      this.showAlert(
        "Camera access requires a secure context. " +
          "Please serve this page over HTTPS or from localhost. " +
          `Current protocol: ${window.location.protocol}`,
        "warning"
      );
      return false;
    }

    console.log("Camera support check passed");
    return true;
  }

  disableScanner() {
    const startBtn = document.getElementById("startScannerBtn");
    const stopBtn = document.getElementById("stopScannerBtn");

    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;

    const scannerContainer = document.getElementById("qrScanner");
    if (scannerContainer) {
      scannerContainer.innerHTML = `
                <div class="scanner-placeholder">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                    <p>Scanner not available</p>
                    <small class="text-muted">Use manual QR code input below</small>
                </div>
            `;
    }
  }

  async startQRScanner() {
    try {
      // Check if scanner is already active
      if (this.isScannerActive) {
        this.showAlert("Scanner is already running", "warning");
        return;
      }

      // Check if library is loaded
      if (!this.libraryLoaded) {
        this.showAlert(
          "QR scanner library not available. Please refresh the page.",
          "danger"
        );
        return;
      }

      // Check camera support first
      if (!this.checkCameraSupport()) {
        return;
      }

      const scannerContainer = document.getElementById("qrScanner");

      // Show loading in scanner container
      scannerContainer.innerHTML = `
                <div class="scanner-placeholder">
                    <div class="spinner"></div>
                    <p>Starting camera...</p>
                </div>
            `;

      // Initialize the scanner
      this.html5QrcodeScanner = new Html5Qrcode("qrScanner");

      const config = {
        fps: 10,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          // make box 80% of the smaller dimension
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrBoxSize = Math.floor(minEdge * 0.8);
          return { width: qrBoxSize, height: qrBoxSize };
        },
        aspectRatio: 1.0,
      };

      console.log("Starting QR scanner...");

      // Try to get available cameras
      let cameraId = null;
      try {
        const cameras = await Html5Qrcode.getCameras();
        console.log("Available cameras:", cameras);

        if (cameras && cameras.length > 0) {
          // Prefer back camera
          const backCamera = cameras.find(
            (camera) =>
              camera.label.toLowerCase().includes("back") ||
              camera.label.toLowerCase().includes("rear")
          );
          cameraId = backCamera ? backCamera.id : cameras[0].id;
          console.log("Selected camera:", cameraId);
        } else {
          console.warn("No cameras found");
        }
      } catch (cameraError) {
        console.warn("Could not enumerate cameras:", cameraError);
        // Continue with default camera
      }

      // Start scanning
      await this.html5QrcodeScanner.start(
        cameraId || { facingMode: "environment" },
        config,
        (qrCodeMessage) => this.onScanSuccess(qrCodeMessage),
        (errorMessage) => this.onScanFailure(errorMessage)
      );

      this.isScannerActive = true;
      this.updateScannerUI(true);
      this.updateCheckinStatus("Scanning...", "status-active");

      console.log("QR Scanner started successfully");
    } catch (error) {
      console.error("Error starting QR scanner:", error);

      let errorMessage = `Failed to start camera: ${error.message}`;

      // Provide more user-friendly error messages
      if (
        error.message.includes("Permission denied") ||
        error.name === "NotAllowedError"
      ) {
        errorMessage =
          "Camera permission denied. Please allow camera access in your browser settings and try again.";
      } else if (
        error.message.includes("NotFoundError") ||
        error.message.includes("No camera found")
      ) {
        errorMessage =
          "No camera found. Please check if your device has a camera.";
      } else if (error.message.includes("NotAllowedError")) {
        errorMessage =
          "Camera access denied. Please allow camera permissions in your browser settings.";
      } else if (error.message.includes("NotSupportedError")) {
        errorMessage =
          "Camera not supported in this browser. Please try Chrome, Firefox, or Edge.";
      } else if (error.message.includes("Could not start video stream")) {
        errorMessage =
          "Could not start camera. Please check if another application is using the camera.";
      }

      this.showAlert(errorMessage, "danger");
      this.updateCheckinStatus("Camera error", "status-error");
      this.updateScannerUI(false);

      // Show error in scanner container
      const scannerContainer = document.getElementById("qrScanner");
      if (scannerContainer) {
        scannerContainer.innerHTML = `
                    <div class="scanner-placeholder">
                        <i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger"></i>
                        <p>Camera Error</p>
                        <small class="text-muted">${errorMessage}</small>
                        <div class="mt-2">
                            <button class="btn btn-warning btn-sm" onclick="adminCheckin.startQRScanner()">
                                <i class="fas fa-redo"></i> Try Again
                            </button>
                        </div>
                    </div>
                `;
      }
    }
  }

  async stopQRScanner() {
    if (this.html5QrcodeScanner && this.isScannerActive) {
      try {
        await this.html5QrcodeScanner.stop();
        this.html5QrcodeScanner.clear();
        this.isScannerActive = false;
        this.updateScannerUI(false);
        this.updateCheckinStatus("Scanner stopped", "status-pending");
        console.log("QR Scanner stopped successfully");
      } catch (error) {
        console.error("Error stopping QR scanner:", error);
        this.showAlert("Error stopping scanner", "danger");
      }
    }
  }

  updateScannerUI(isActive) {
    const startBtn = document.getElementById("startScannerBtn");
    const stopBtn = document.getElementById("stopScannerBtn");
    const scannerContainer = document.getElementById("qrScanner");

    if (isActive) {
      if (startBtn) startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      // Scanner will render its own UI
    } else {
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (scannerContainer && !this.isScannerActive) {
        scannerContainer.innerHTML = `
                    <div class="scanner-placeholder">
                        <i class="fas fa-camera fa-3x mb-3"></i>
                        <p>Camera not started</p>
                        <button class="btn btn-success btn-sm mt-2" onclick="adminCheckin.startQRScanner()">
                            <i class="fas fa-play"></i> Start Camera
                        </button>
                    </div>
                `;
      }
    }
  }

  async onScanSuccess(qrCodeMessage) {
    console.log("QR Code scanned:", qrCodeMessage);

    // Stop scanner temporarily to prevent multiple scans
    if (this.isScannerActive) {
      await this.stopQRScanner();
    }

    // Parse the QR code message to extract the qrCodeId
    let qrCodeId;
    try {
      // Try to parse as JSON first
      const qrData = JSON.parse(qrCodeMessage);
      qrCodeId = qrData.qrCodeId;
      console.log("Parsed QR data, extracted qrCodeId:", qrCodeId);
    } catch (e) {
      // If it's not JSON, use the raw string
      qrCodeId = qrCodeMessage;
      console.log("Using raw QR code as ID:", qrCodeId);
    }

    if (!qrCodeId) {
      this.showAlert("Invalid QR code format", "danger");
      return;
    }

    await this.processCheckin(qrCodeId);
  }

  async processManualCheckin(qrCode) {
    let qrCodeId;
    try {
      // Try to parse as JSON first for manual input too
      const qrData = JSON.parse(qrCode);
      qrCodeId = qrData.qrCodeId;
      console.log("Parsed manual QR data, extracted qrCodeId:", qrCodeId);
    } catch (e) {
      // If it's not JSON, use the raw string
      qrCodeId = qrCode;
      console.log("Using raw manual QR code as ID:", qrCodeId);
    }

    if (!qrCodeId) {
      this.showAlert("Invalid QR code format", "danger");
      return;
    }

    await this.processCheckin(qrCodeId);
  }

  async processCheckin(qrCode) {
    this.updateCheckinStatus("Processing...", "status-active");
    this.showLoading(true);

    try {
      // Validate QR code format
      if (!qrCode || qrCode.trim() === "") {
        throw new Error("Invalid QR code");
      }

      // Call API to verify membership and get user details
      const response = await fetch(
        `/api/membership/checkin/${encodeURIComponent(qrCode)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Check-in failed");
      }

      const result = await response.json();

      if (result.success) {
        // Display user info with confirmation buttons (don't auto-checkin)
        this.displayUserInfo(result.membership, qrCode);
        this.updateCheckinStatus("Ready to check in", "status-pending");
      } else {
        throw new Error(result.message || "Check-in failed");
      }
    } catch (error) {
      console.error("Check-in error:", error);
      this.displayError(error.message);
      this.updateCheckinStatus("Check-in failed", "status-error");
      this.showAlert(`Check-in failed: ${error.message}`, "danger");
    } finally {
      this.showLoading(false);
    }
  }

  onScanFailure(errorMessage) {
    // This is called for non-fatal scanning errors (like no QR code found)
    // We don't need to show alerts for these
    if (!errorMessage.includes("NotFoundException")) {
      console.log("Scan failure:", errorMessage);
    }
  }

  displayUserInfo(membership, qrCode) {
    const userInfoBody = document.getElementById("userInfoBody");

    if (!membership) {
      this.displayError("No membership data received");
      return;
    }

    // Store the current membership data for the check-in process
    this.currentMembership = membership;
    this.currentQrCode = qrCode;

    const membershipEndDate = new Date(membership.endDate).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    userInfoBody.innerHTML = `
            <div class="user-details">
                <div class="user-profile">
                    <img src="${
                      membership.profilePicture || "/images/default-profile.png"
                    }" 
                         alt="Profile" 
                         class="user-avatar"
                         onerror="this.src='/images/default-profile.png'">
                    <div class="user-name">${membership.firstName} ${
      membership.lastName
    }</div>
                    <span class="plan-badge plan-${
                      membership.planType
                        ? membership.planType.toLowerCase()
                        : "basic"
                    }">
                        ${membership.planType || "Unknown"}
                    </span>
                </div>
                
                <div class="user-detail-grid">
                    <div class="user-detail-item">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${
                          membership.email || "N/A"
                        }</div>
                    </div>
                    <div class="user-detail-item">
                        <div class="detail-label">Phone</div>
                        <div class="detail-value">${
                          membership.phone || membership.mobile || "N/A"
                        }</div>
                    </div>
                    <div class="user-detail-item">
                        <div class="detail-label">QR Code ID</div>
                        <div class="detail-value text-monospace">${
                          membership.qrCodeId || "N/A"
                        }</div>
                    </div>
                    <div class="user-detail-item">
                        <div class="detail-label">Membership End</div>
                        <div class="detail-value">${membershipEndDate}</div>
                    </div>
                </div>
                
                <div class="membership-info">
                    <div class="detail-label">Membership Status</div>
                    <div class="detail-value text-success">
                        <i class="fas fa-check-circle"></i> Active
                    </div>
                    <small class="text-muted">Valid until ${membershipEndDate}</small>
                </div>
                
                <!-- Check-in Confirmation Buttons -->
                <div class="checkin-confirmation mt-4">
                    <div class="confirmation-buttons">
                        <button class="btn btn-success me-2" id="confirmCheckinBtn">
                            <i class="fas fa-check"></i> Confirm Check-in
                        </button>
                        <button class="btn btn-secondary" id="cancelCheckinBtn">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                    <small class="text-muted d-block mt-2">
                        Click "Confirm Check-in" to record this visit in the system
                    </small>
                </div>
            </div>
        `;

    // Add event listeners to the buttons using the bound methods
    const confirmBtn = document.getElementById("confirmCheckinBtn");
    const cancelBtn = document.getElementById("cancelCheckinBtn");

    if (confirmBtn) {
      confirmBtn.addEventListener("click", this.performCheckin);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", this.cancelCheckin);
    }

    // Update status badge
    const statusBadge = document.getElementById("membershipStatusBadge");
    if (statusBadge) {
      statusBadge.className = "status-badge status-pending";
      statusBadge.textContent = "Ready to Check In";
    }
  }

  // New method to perform the actual check-in
  async performCheckin() {
    if (!this.currentMembership || !this.currentQrCode) {
      this.showAlert("No membership data available", "danger");
      return;
    }

    this.updateCheckinStatus("Recording check-in...", "status-active");
    this.showLoading(true);

    try {
      // Record check-in in the database
      const result = await this.recordCheckin(
        this.currentQrCode,
        this.currentMembership
      );

      if (result.success) {
        this.showCheckinSuccess();
        this.updateCheckinStatus("Check-in recorded!", "status-success");
        this.showAlert(
          `Successfully checked in ${this.currentMembership.firstName} ${this.currentMembership.lastName}`,
          "success"
        );

        // Log successful check-in in console
        console.log("✅ Admin check-in completed and logged:", {
          member: `${this.currentMembership.firstName} ${this.currentMembership.lastName}`,
          qrCodeId: this.currentQrCode,
          time: new Date().toISOString(),
        });
      } else {
        throw new Error(result.message || "Failed to record check-in");
      }
    } catch (error) {
      console.error("Check-in recording error:", error);
      this.displayError(error.message);
      this.updateCheckinStatus("Check-in failed", "status-error");
      this.showAlert(`Check-in failed: ${error.message}`, "danger");
    } finally {
      this.showLoading(false);
    }
  }

  // Method to show success state after check-in
  showCheckinSuccess() {
    const userInfoBody = document.getElementById("userInfoBody");
    const today = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    userInfoBody.innerHTML = `
            <div class="user-details">
                <div class="user-profile">
                    <img src="${
                      this.currentMembership.profilePicture ||
                      "/images/default-profile.png"
                    }" 
                         alt="Profile" 
                         class="user-avatar"
                         onerror="this.src='/images/default-profile.png'">
                    <div class="user-name">${
                      this.currentMembership.firstName
                    } ${this.currentMembership.lastName}</div>
                    <span class="plan-badge plan-${
                      this.currentMembership.planType
                        ? this.currentMembership.planType.toLowerCase()
                        : "basic"
                    }">
                        ${this.currentMembership.planType || "Unknown"}
                    </span>
                </div>
                
                <div class="checkin-success">
                    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <div class="detail-value">Successfully Checked In!</div>
                    <small>${today} at ${currentTime}</small>
                </div>
                
                <div class="mt-3">
                    <button class="btn btn-primary" id="scanNextBtn">
                        <i class="fas fa-redo"></i> Scan Next Member
                    </button>
                </div>
            </div>
        `;

    // Add event listener for scan next button
    const scanNextBtn = document.getElementById("scanNextBtn");
    if (scanNextBtn) {
      scanNextBtn.addEventListener("click", () => {
        this.cancelCheckin();
        this.startQRScanner();
      });
    }

    // Update status badge
    const statusBadge = document.getElementById("membershipStatusBadge");
    if (statusBadge) {
      statusBadge.className = "status-badge status-success";
      statusBadge.textContent = "Checked In";
    }
  }

  // Method to cancel check-in
  cancelCheckin() {
    this.currentMembership = null;
    this.currentQrCode = null;

    const userInfoBody = document.getElementById("userInfoBody");
    userInfoBody.innerHTML = `
            <div class="text-center text-muted p-4">
                <i class="fas fa-user fa-4x mb-3"></i>
                <p>Scan a QR code to display member information</p>
            </div>
        `;

    // Update status badge
    const statusBadge = document.getElementById("membershipStatusBadge");
    if (statusBadge) {
      statusBadge.className = "status-badge status-pending";
      statusBadge.textContent = "No scan yet";
    }

    // Restart scanner
    if (this.libraryLoaded && !this.isScannerActive) {
      setTimeout(() => {
        this.startQRScanner();
      }, 500);
    }
  }

  displayError(errorMessage) {
    const userInfoBody = document.getElementById("userInfoBody");

    userInfoBody.innerHTML = `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h5 class="text-danger">Check-in Failed</h5>
                <p class="text-muted">${errorMessage}</p>
                <button class="btn btn-primary mt-2" id="tryAgainBtn">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;

    // Add event listener for try again button
    const tryAgainBtn = document.getElementById("tryAgainBtn");
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener("click", () => {
        this.cancelCheckin();
        this.startQRScanner();
      });
    }

    // Update status badge
    const statusBadge = document.getElementById("membershipStatusBadge");
    if (statusBadge) {
      statusBadge.className = "status-badge status-error";
      statusBadge.textContent = "Error";
    }
  }

  async recordCheckin(qrCodeId, membership) {
    try {
      const checkinTime = new Date().toISOString();

      const response = await fetch("/api/membership/record-checkin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          qrCodeId: qrCodeId,
          membershipId: membership._id,
          userId: membership.userId,
          checkinTime: checkinTime,
          // Add all the additional data (excluding profilePicture)
          planType: membership.planType,
          firstName: membership.firstName,
          lastName: membership.lastName,
          email: membership.email,
          phone: membership.phone,
          startDate: membership.startDate,
          endDate: membership.endDate,
          appliedAt: membership.appliedAt,
          // Add manual entry flag for logging
          manualEntry: !this.isScannerActive, // True if manual search, false if QR scan
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to record check-in");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error recording check-in:", error);
      throw error;
    }
  }

  updateCheckinStatus(message, statusClass) {
    const statusElement = document.getElementById("checkinStatus");
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `badge ${statusClass}`;
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
    if (!alertContainer) return;

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

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  window.adminCheckin = new AdminCheckin();
});
