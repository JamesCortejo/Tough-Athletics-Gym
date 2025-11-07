// src/public/js/adminJS/adminOverview.js

document.addEventListener("DOMContentLoaded", function () {
  // Initialize the overview dashboard
  initOverview();

  // Set up event listeners
  document
    .getElementById("timeRange")
    .addEventListener("change", refreshCharts);
});

// Store chart instances
const chartInstances = {
  membershipGrowthChart: null,
  planDistributionChart: null,
  checkinActivityChart: null,
  genderDistributionChart: null,
  ageDistributionChart: null,
  revenueBreakdownChart: null,
  applicationStatusChart: null,
};

async function initOverview() {
  // Show loading overlay
  showLoading();

  try {
    // Fetch initial data (without recent activity)
    await Promise.all([fetchStats(), fetchChartData()]);
    hideLoading();
  } catch (error) {
    console.error("Error initializing overview:", error);
    hideLoading();
    showAlert("Failed to load overview data. Please try again.", "danger");
  }
}

async function fetchStats() {
  try {
    const token = getAdminToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const response = await fetch("/api/overview/stats", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        handleUnauthorized();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch stats");
    }

    const stats = data.stats;

    // Update stats cards with actual data
    document.getElementById("totalUsers").textContent = stats.totalUsers;
    document.getElementById("activeMembers").textContent = stats.activeMembers;
    document.getElementById("pendingApplications").textContent =
      stats.pendingApplications;
    document.getElementById("todayCheckins").textContent = stats.todayCheckins;
    document.getElementById("revenue").textContent = `₱${stats.monthlyRevenue}`;
    document.getElementById("avgAttendance").textContent = stats.avgAttendance;

    // For demonstration, using placeholder change values
    // In a real app, you'd compare with previous period
    updateChangeIndicator("userChange", 14.3);
    updateChangeIndicator("memberChange", 33.3);
    updateChangeIndicator("applicationChange", -50);
    updateChangeIndicator("checkinChange", 100);
    updateChangeIndicator("revenueChange", 25);
    updateChangeIndicator("attendanceChange", 16.7);
  } catch (error) {
    console.error("Error fetching stats:", error);
    if (error.message !== "No authentication token found") {
      showAlert("Failed to load statistics", "danger");
    }
  }
}

async function fetchChartData() {
  try {
    const token = getAdminToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    const timeRange = document.getElementById("timeRange").value;

    const response = await fetch(
      `/api/overview/charts?timeRange=${timeRange}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        handleUnauthorized();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch chart data");
    }

    const chartData = data.chartData;

    // Debug: log the gender distribution data
    console.log("🎯 Gender Distribution Data:", chartData.genderDistribution);

    // Render all charts
    renderMembershipGrowthChart(chartData.membershipGrowth);
    renderPlanDistributionChart(chartData.planDistribution);
    renderCheckinActivityChart(chartData.checkinActivity);
    renderGenderDistributionChart(chartData.genderDistribution);
    renderAgeDistributionChart(chartData.ageDistribution);
    renderRevenueBreakdownChart(chartData.revenueBreakdown);
    renderApplicationStatusChart(chartData.applicationStatus);
  } catch (error) {
    console.error("Error fetching chart data:", error);
    if (error.message !== "No authentication token found") {
      showAlert("Failed to load chart data", "danger");
    }
  }
}

function updateChangeIndicator(elementId, changeValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const arrow = element.querySelector("i");
  const span = element.querySelector("span");

  span.textContent = `${Math.abs(changeValue)}%`;

  if (changeValue >= 0) {
    arrow.className = "fas fa-arrow-up text-success";
    span.className = "text-success";
  } else {
    arrow.className = "fas fa-arrow-down text-danger";
    span.className = "text-danger";
  }
}

// Chart rendering functions
function renderMembershipGrowthChart(data) {
  const ctx = document.getElementById("membershipGrowthChart");
  if (!ctx) return;

  // Destroy existing chart if it exists
  if (chartInstances.membershipGrowthChart) {
    chartInstances.membershipGrowthChart.destroy();
  }

  chartInstances.membershipGrowthChart = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "New Members",
          data: data.newMembers,
          borderColor: "#4e73df",
          backgroundColor: "rgba(78, 115, 223, 0.1)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Total Members",
          data: data.totalMembers,
          borderColor: "#1cc88a",
          backgroundColor: "rgba(28, 200, 138, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            drawBorder: false,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function renderPlanDistributionChart(data) {
  const ctx = document.getElementById("planDistributionChart");
  if (!ctx) return;

  if (chartInstances.planDistributionChart) {
    chartInstances.planDistributionChart.destroy();
  }

  chartInstances.planDistributionChart = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [
        {
          data: data.data,
          backgroundColor: data.colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderCheckinActivityChart(data) {
  const ctx = document.getElementById("checkinActivityChart");
  if (!ctx) return;

  if (chartInstances.checkinActivityChart) {
    chartInstances.checkinActivityChart.destroy();
  }

  chartInstances.checkinActivityChart = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Check-ins",
          data: data.data,
          backgroundColor: "#4e73df",
          borderColor: "#4e73df",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            drawBorder: false,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function renderGenderDistributionChart(data) {
  const ctx = document.getElementById("genderDistributionChart");
  if (!ctx) return;

  if (chartInstances.genderDistributionChart) {
    chartInstances.genderDistributionChart.destroy();
  }

  // Check if we have data to display
  const total = data.data.reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    // Show a message when no data is available
    ctx.parentElement.innerHTML = `
            <div class="text-center text-muted p-4">
                <i class="fas fa-users fa-2x mb-2"></i>
                <p>No gender data available</p>
            </div>
        `;
    return;
  }

  // Filter out zero values for cleaner chart
  const filteredLabels = [];
  const filteredData = [];
  const filteredColors = [];

  data.labels.forEach((label, index) => {
    if (data.data[index] > 0) {
      filteredLabels.push(label);
      filteredData.push(data.data[index]);
      filteredColors.push(data.colors[index]);
    }
  });

  chartInstances.genderDistributionChart = new Chart(ctx.getContext("2d"), {
    type: "pie",
    data: {
      labels: filteredLabels,
      datasets: [
        {
          data: filteredData,
          backgroundColor: filteredColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

function renderAgeDistributionChart(data) {
  const ctx = document.getElementById("ageDistributionChart");
  if (!ctx) return;

  if (chartInstances.ageDistributionChart) {
    chartInstances.ageDistributionChart.destroy();
  }

  chartInstances.ageDistributionChart = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Members",
          data: data.data,
          backgroundColor: data.colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            drawBorder: false,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function renderRevenueBreakdownChart(data) {
  const ctx = document.getElementById("revenueBreakdownChart");
  if (!ctx) return;

  if (chartInstances.revenueBreakdownChart) {
    chartInstances.revenueBreakdownChart.destroy();
  }

  chartInstances.revenueBreakdownChart = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Revenue (₱)",
          data: data.data,
          backgroundColor: data.colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            drawBorder: false,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function renderApplicationStatusChart(data) {
  const ctx = document.getElementById("applicationStatusChart");
  if (!ctx) return;

  if (chartInstances.applicationStatusChart) {
    chartInstances.applicationStatusChart.destroy();
  }

  // Check if we have data to display
  const total = data.data.reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    // Show a message when no data is available
    ctx.parentElement.innerHTML = `
            <div class="text-center text-muted p-4">
                <i class="fas fa-id-card fa-2x mb-2"></i>
                <p>No application data available</p>
            </div>
        `;
    return;
  }

  // Filter out zero values for cleaner chart
  const filteredLabels = [];
  const filteredData = [];
  const filteredColors = [];

  data.labels.forEach((label, index) => {
    if (data.data[index] > 0) {
      filteredLabels.push(label);
      filteredData.push(data.data[index]);
      filteredColors.push(data.colors[index]);
    }
  });

  chartInstances.applicationStatusChart = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: filteredLabels,
      datasets: [
        {
          data: filteredData,
          backgroundColor: filteredColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

function refreshCharts() {
  showLoading();
  fetchChartData().then(() => {
    hideLoading();
  });
}

// Utility functions
function getAdminToken() {
  // Get token from localStorage where adminCommon stores it
  return localStorage.getItem("adminToken");
}

function handleUnauthorized() {
  showAlert("Your session has expired. Please login again.", "warning");
  setTimeout(() => {
    window.location.href = "/admin/login";
  }, 2000);
}

function showLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

function showAlert(message, type) {
  const alertContainer = document.getElementById("alertContainer");
  if (!alertContainer) return;

  const alertId = "alert-" + Date.now();

  const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

  alertContainer.insertAdjacentHTML("beforeend", alertHTML);

  // Auto remove after 5 seconds
  setTimeout(() => {
    const alert = document.getElementById(alertId);
    if (alert) {
      alert.remove();
    }
  }, 5000);
}
