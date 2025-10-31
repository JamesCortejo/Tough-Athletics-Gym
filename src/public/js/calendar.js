// calendar.js - Reusable Calendar Component
class MembershipCalendar {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.currentDate = new Date();
    this.startDate = options.startDate || null;
    this.endDate = options.endDate || null;
    this.onDateClick = options.onDateClick || null;
    this.showLegend = options.showLegend !== false;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    const calendarHTML = `
            <div class="calendar-section">
                <h4 class="calendar-title">${this.getTitle()}</h4>
                <div class="calendar-container">
                    <div class="calendar-header">
                        <button class="calendar-nav prev-month">&lt;</button>
                        <h5 class="calendar-month">${this.getMonthYear()}</h5>
                        <button class="calendar-nav next-month">&gt;</button>
                    </div>
                    <div class="calendar-weekdays">
                        <div class="weekday">Sun</div>
                        <div class="weekday">Mon</div>
                        <div class="weekday">Tue</div>
                        <div class="weekday">Wed</div>
                        <div class="weekday">Thu</div>
                        <div class="weekday">Fri</div>
                        <div class="weekday">Sat</div>
                    </div>
                    <div class="calendar-days">${this.generateDays()}</div>
                </div>
                ${this.showLegend ? this.generateLegend() : ""}
            </div>
        `;

    this.container.innerHTML = calendarHTML;
  }

  getTitle() {
    return this.startDate && this.endDate ? "Membership Period" : "Calendar";
  }

  getMonthYear() {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${
      monthNames[this.currentDate.getMonth()]
    } ${this.currentDate.getFullYear()}`;
  }

  generateDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const today = new Date();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    let calendarHTML = "";

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>';
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day);
      let dayClass = "calendar-day";
      let tooltip = "";

      // Check if this day is today
      if (currentDay.toDateString() === today.toDateString()) {
        dayClass += " today";
        tooltip = "Today";
      }
      // Check if this day is within membership period
      else if (this.isDateInRange(currentDay)) {
        dayClass += " active";
        tooltip = this.getRangeTooltip(currentDay);
      }
      // Check if this day is in the past
      else if (currentDay < today) {
        dayClass += " past";
      }
      // Future days (not in membership period)
      else {
        dayClass += " future";
      }

      // Add click event if callback provided
      if (this.onDateClick) {
        dayClass += " clickable";
        calendarHTML += `<div class="${dayClass}" data-date="${currentDay.toISOString()}" title="${tooltip}">${day}</div>`;
      } else {
        calendarHTML += `<div class="${dayClass}" title="${tooltip}">${day}</div>`;
      }
    }

    return calendarHTML;
  }

  isDateInRange(date) {
    if (!this.startDate || !this.endDate) return false;

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    date.setHours(0, 0, 0, 0);

    return date >= start && date <= end;
  }

  getRangeTooltip(date) {
    if (!this.startDate || !this.endDate) return "";

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (date.toDateString() === start.toDateString()) {
      return "Membership starts";
    } else if (date.toDateString() === end.toDateString()) {
      return "Membership ends";
    } else {
      return "Active membership day";
    }
  }

  generateLegend() {
    return `
            <div class="calendar-legend">
                <div class="legend-item">
                    <div class="legend-color active-day"></div>
                    <span>Membership Period</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color today"></div>
                    <span>Today</span>
                </div>
            </div>
        `;
  }

  bindEvents() {
    // Navigation events
    this.container.addEventListener("click", (e) => {
      if (e.target.classList.contains("prev-month")) {
        this.prevMonth();
      } else if (e.target.classList.contains("next-month")) {
        this.nextMonth();
      } else if (e.target.classList.contains("clickable") && this.onDateClick) {
        const date = new Date(e.target.getAttribute("data-date"));
        this.onDateClick(date);
      }
    });
  }

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  }

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  }

  // Public methods to update dates
  updateDates(startDate, endDate) {
    this.startDate = startDate;
    this.endDate = endDate;
    this.render();
  }

  setCurrentDate(date) {
    this.currentDate = new Date(date);
    this.render();
  }

  // Destroy method for cleanup
  destroy() {
    this.container.innerHTML = "";
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = MembershipCalendar;
}
