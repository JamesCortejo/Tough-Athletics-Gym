// tsopManager.js - Timestamp Ordering Protocol for Account Manager
class TSOPManager {
  constructor() {
    this.editLocks = new Map(); // userId -> { adminId, timestamp, adminName }
    this.pendingRequests = new Map(); // userId -> array of pending requests
    this.timeoutDuration = 30000; // 30 seconds lock timeout
  }

  // Request edit lock for a user account
  async requestEditLock(userId, adminId, adminName) {
    const now = Date.now();

    // Check if user is already being edited
    const existingLock = this.editLocks.get(userId);

    if (existingLock) {
      // If same admin, refresh the lock
      if (existingLock.adminId === adminId) {
        existingLock.timestamp = now;
        return { success: true, lock: existingLock };
      }

      // Check if lock has expired
      if (now - existingLock.timestamp > this.timeoutDuration) {
        console.log(`🔓 Lock expired for user ${userId}, acquiring new lock`);
        this.releaseEditLock(userId);
      } else {
        // User is being edited by another admin
        return {
          success: false,
          message: `This account is currently being edited by ${
            existingLock.adminName
          } since ${new Date(existingLock.timestamp).toLocaleTimeString()}`,
          lockedBy: existingLock.adminName,
          lockedSince: existingLock.timestamp,
        };
      }
    }

    // Acquire new lock
    const newLock = {
      adminId,
      adminName,
      timestamp: now,
      userId: userId,
    };

    this.editLocks.set(userId, newLock);

    // Set timeout to automatically release lock
    setTimeout(() => {
      const currentLock = this.editLocks.get(userId);
      if (currentLock && currentLock.adminId === adminId) {
        console.log(`⏰ Auto-releasing lock for user ${userId} after timeout`);
        this.releaseEditLock(userId);
      }
    }, this.timeoutDuration);

    console.log(`🔒 Lock acquired for user ${userId} by ${adminName}`);
    return { success: true, lock: newLock };
  }

  // Release edit lock
  releaseEditLock(userId) {
    const lock = this.editLocks.get(userId);
    if (lock) {
      console.log(`🔓 Lock released for user ${userId} by ${lock.adminName}`);
      this.editLocks.delete(userId);

      // Process any pending requests
      this.processPendingRequests(userId);
    }
    return true;
  }

  // Force release lock (for admin actions)
  forceReleaseLock(userId, adminId) {
    const lock = this.editLocks.get(userId);
    if (lock && lock.adminId === adminId) {
      this.releaseEditLock(userId);
      return true;
    }
    return false;
  }

  // Get current lock status
  getLockStatus(userId) {
    const lock = this.editLocks.get(userId);
    if (!lock) return null;

    const now = Date.now();
    const timeElapsed = now - lock.timestamp;
    const timeRemaining = this.timeoutDuration - timeElapsed;

    return {
      ...lock,
      timeElapsed,
      timeRemaining,
      isExpired: timeElapsed > this.timeoutDuration,
    };
  }

  // Clean up expired locks
  cleanupExpiredLocks() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, lock] of this.editLocks.entries()) {
      if (now - lock.timestamp > this.timeoutDuration) {
        this.editLocks.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired locks`);
    }

    return cleanedCount;
  }

  // Get all active locks
  getAllActiveLocks() {
    this.cleanupExpiredLocks();
    return Array.from(this.editLocks.entries()).map(([userId, lock]) => ({
      userId,
      ...lock,
    }));
  }

  // Add pending request (for future enhancement)
  addPendingRequest(userId, request) {
    if (!this.pendingRequests.has(userId)) {
      this.pendingRequests.set(userId, []);
    }
    this.pendingRequests.get(userId).push(request);
  }

  // Process pending requests (for future enhancement)
  processPendingRequests(userId) {
    const requests = this.pendingRequests.get(userId);
    if (requests && requests.length > 0) {
      // In a real system, you might notify the next requester
      console.log(`📨 ${requests.length} pending requests for user ${userId}`);
      this.pendingRequests.delete(userId);
    }
  }
}

// Create global instance
const tsopManager = new TSOPManager();

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = tsopManager;
}
