class NotificationManager {
  constructor() {
    this.isOpen = false;
    this.notifications = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadNotifications();
    // Refresh notifications every 30 seconds
    setInterval(() => this.loadNotifications(), 30000);
  }

  bindEvents() {
    // Toggle dropdown
    document.getElementById("notifBtn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Close dropdown with close button
    document.getElementById("notifCloseBtn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeDropdown();
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (
        this.isOpen &&
        !e.target.closest(".notif-box") &&
        !e.target.closest("#notifBtn")
      ) {
        this.closeDropdown();
      }
    });

    // Mark all as read
    document.getElementById("markAllReadBtn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.markAllAsRead();
    });

    // Clear all notifications
    document.getElementById("clearAllBtn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearAllNotifications();
    });

    // Close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.closeDropdown();
      }
    });

    // Prevent closing when clicking inside notification box
    document.querySelector(".notif-box").addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    const dropdown = document.getElementById("notifDropdown");
    dropdown.classList.add("active");
    this.isOpen = true;
    this.loadNotifications(); // Refresh when opening
  }

  closeDropdown() {
    const dropdown = document.getElementById("notifDropdown");
    dropdown.classList.remove("active");
    this.isOpen = false;
  }

  async loadNotifications() {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/notifications?limit=20", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        this.notifications = result.notifications;
        this.renderNotifications();
        this.updateBadge(result.unreadCount);
      } else {
        console.error("Failed to load notifications:", result.message);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  }

  renderNotifications() {
    const notifList = document.getElementById("notifList");

    if (this.notifications.length === 0) {
      notifList.innerHTML = `
                <div class="notif-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
      return;
    }

    notifList.innerHTML = this.notifications
      .map(
        (notif) => `
            <div class="notif-item ${!notif.isRead ? "unread" : "read"} ${
          notif.type || ""
        }" 
                 data-id="${notif._id}">
                <div class="notif-item-header">
                    <div class="notif-title">${this.escapeHtml(
                      notif.title
                    )}</div>
                    <div class="notif-time">${this.formatTime(
                      notif.createdAt
                    )}</div>
                </div>
                <div class="notif-message">${this.escapeHtml(
                  notif.message
                )}</div>
            </div>
        `
      )
      .join("");

    // Add click events to mark as read
    notifList.querySelectorAll(".notif-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const notificationId = item.getAttribute("data-id");
        this.markAsRead(notificationId);
      });
    });
  }

  async markAsRead(notificationId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update UI
        const item = document.querySelector(`[data-id="${notificationId}"]`);
        if (item) {
          item.classList.remove("unread");
          item.classList.add("read");
        }
        this.loadNotifications(); // Refresh count
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }

  async markAllAsRead() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        this.loadNotifications();
      } else {
        alert("Failed to mark all as read: " + result.message);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
      alert("Error marking all as read");
    }
  }

  async clearAllNotifications() {
    if (!confirm("Are you sure you want to clear all notifications?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        this.loadNotifications();
      } else {
        alert("Failed to clear notifications: " + result.message);
      }
    } catch (error) {
      console.error("Error clearing notifications:", error);
      alert("Error clearing notifications");
    }
  }

  updateBadge(count) {
    const badge = document.getElementById("notifBadge");
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  new NotificationManager();
});
