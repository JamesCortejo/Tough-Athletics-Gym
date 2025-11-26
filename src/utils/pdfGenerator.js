const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

class PDFGenerator {
  constructor() {
    try {
      this.logoPath = path.join(
        __dirname,
        "../public/images/icons/bannerlogo.png"
      );
      // Verify logo exists
      if (!fs.existsSync(this.logoPath)) {
        console.warn("Logo not found at:", this.logoPath);
        this.logoPath = null;
      }
    } catch (error) {
      console.warn("Could not initialize logo path:", error.message);
      this.logoPath = null;
    }

    this.pageWidth = 612;
    this.pageHeight = 792;
    this.margin = 50;
    this.contentWidth = this.pageWidth - 2 * this.margin;
  }

  // Input validation helper
  validateMembershipData(membership) {
    return {
      firstName: membership.firstName || "Unknown",
      lastName: membership.lastName || "Unknown",
      planType: membership.planType || "Unknown",
      status: membership.status || "Unknown",
      amount: Number(membership.amount) || 0,
      startDate: membership.startDate
        ? new Date(membership.startDate)
        : new Date(),
      endDate: membership.endDate ? new Date(membership.endDate) : new Date(),
      email: membership.email || "No email",
    };
  }

  validateCheckinData(checkin) {
    return {
      firstName: checkin.firstName || "Unknown",
      lastName: checkin.lastName || "Unknown",
      planType: checkin.planType || "Unknown",
      checkinTime: checkin.checkinTime
        ? new Date(checkin.checkinTime)
        : new Date(),
      checkedInBy: checkin.checkedInBy || { adminName: "System" },
      userId: checkin.userId || "Unknown",
    };
  }

  // Text truncation helper
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || "";
    return text.substring(0, maxLength - 3) + "...";
  }

  // Validate non-member data
  validateNonMemberData(nonMember) {
    return {
      firstName: nonMember.firstName || "Unknown",
      lastName: nonMember.lastName || "Unknown",
      phone: nonMember.phone || "No phone",
      email: nonMember.email || "No email",
      address: nonMember.address || "No address",
      amount: Number(nonMember.amount) || 0,
      paymentMethod: nonMember.paymentMethod || "Cash at Gym",
      checkInTime: nonMember.checkInTime
        ? new Date(nonMember.checkInTime)
        : new Date(),
    };
  }

  // Generate Revenue Report (updated to include non-member revenue)
  async generateRevenueReport(memberships, nonMembers = [], period = "all") {
    return new Promise((resolve, reject) => {
      try {
        // Validate input
        if (!Array.isArray(memberships)) {
          throw new Error("Memberships must be an array");
        }
        if (!Array.isArray(nonMembers)) {
          nonMembers = [];
        }

        const doc = new PDFDocument({ margin: this.margin, size: "letter" });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const filteredMemberships = this.filterByPeriod(memberships, period);
        const filteredNonMembers = this.filterByPeriod(
          nonMembers,
          period,
          "checkInTime"
        );

        // Use validated data
        const validatedMemberships = filteredMemberships.map((m) =>
          this.validateMembershipData(m)
        );
        const validatedNonMembers = filteredNonMembers.map((nm) =>
          this.validateNonMemberData(nm)
        );

        // Calculate revenue from memberships
        const membershipRevenue = validatedMemberships.reduce(
          (sum, m) => (m.status === "Active" ? sum + m.amount : sum),
          0
        );

        // Calculate revenue from non-members
        const nonMemberRevenue = validatedNonMembers.reduce(
          (sum, nm) => sum + nm.amount,
          0
        );

        // Total revenue
        const totalRevenue = membershipRevenue + nonMemberRevenue;

        this.addHeader(doc, "Revenue Report", period);
        doc.moveDown(1);

        // Revenue Summary Section
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Financial Summary", this.margin, doc.y);
        doc.moveDown(0.5);

        // Filter out declined memberships for display
        const activeAndPendingMemberships = validatedMemberships.filter(
          (m) => m.status !== "Declined"
        );

        const stats = [
          ["Total Revenue:", `₱${totalRevenue.toLocaleString()}`],
          ["Membership Revenue:", `₱${membershipRevenue.toLocaleString()}`],
          ["Non-Member Revenue:", `₱${nonMemberRevenue.toLocaleString()}`],
          [
            "Active Memberships:",
            validatedMemberships.filter((m) => m.status === "Active").length,
          ],
          [
            "Pending Memberships:",
            validatedMemberships.filter((m) => m.status === "Pending").length,
          ],
          ["Walk-in Customers:", validatedNonMembers.length],
        ];

        stats.forEach(([label, value]) => {
          doc
            .font("Helvetica-Bold")
            .fillColor("#333333")
            .text(label, { continued: true })
            .font("Helvetica")
            .fillColor("#000000")
            .text(` ${value}`);
        });

        doc.moveDown(1.5);

        // Membership Details Table (excluding declined memberships)
        if (activeAndPendingMemberships.length > 0) {
          doc
            .fontSize(14)
            .font("Helvetica-Bold")
            .fillColor("#2c5aa0")
            .text("Membership Details", this.margin, doc.y);
          doc.moveDown(0.5);

          this.addProfessionalTable(
            doc,
            ["Name", "Plan", "Status", "Amount", "Start Date", "End Date"],
            activeAndPendingMemberships.map((m) => [
              this.truncateText(`${m.firstName} ${m.lastName}`, 20),
              m.planType,
              m.status,
              `₱${m.amount.toLocaleString()}`,
              m.startDate.toLocaleDateString(),
              m.endDate.toLocaleDateString(),
            ])
          );
        } else {
          doc
            .fontSize(12)
            .font("Helvetica")
            .fillColor("#666666")
            .text(
              "No membership data available for the selected period.",
              this.margin,
              doc.y
            );
          doc.moveDown(1);
        }

        this.addFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Generate Non-Member Report
  async generateNonMemberReport(nonMembers, period = "all") {
    return new Promise((resolve, reject) => {
      try {
        if (!Array.isArray(nonMembers)) {
          throw new Error("Non-members must be an array");
        }

        const doc = new PDFDocument({ margin: this.margin, size: "letter" });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const filtered = this.filterByPeriod(nonMembers, period, "checkInTime");
        const validatedNonMembers = filtered.map((nm) =>
          this.validateNonMemberData(nm)
        );

        this.addHeader(doc, "Non-Member Report", period);

        // Non-Member Statistics
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Walk-in Customer Statistics", this.margin, doc.y);
        doc.moveDown(0.5);

        const totalRevenue = validatedNonMembers.reduce(
          (sum, nm) => sum + nm.amount,
          0
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayNonMembers = validatedNonMembers.filter(
          (nm) => nm.checkInTime.toDateString() === today.toDateString()
        ).length;

        const stats = [
          ["Total Walk-in Customers:", validatedNonMembers.length],
          ["Today's Walk-ins:", todayNonMembers],
          ["Total Revenue:", `₱${totalRevenue.toLocaleString()}`],
          [
            "Average per Customer:",
            `₱${
              validatedNonMembers.length > 0
                ? Math.round(totalRevenue / validatedNonMembers.length)
                : 0
            }`,
          ],
        ];

        stats.forEach(([label, value]) => {
          doc
            .font("Helvetica-Bold")
            .fillColor("#333333")
            .text(label, { continued: true })
            .font("Helvetica")
            .fillColor("#000000")
            .text(` ${value}`);
        });

        doc.moveDown(1.5);

        // Payment Method Distribution
        const paymentMethodDistribution = {};
        validatedNonMembers.forEach((nm) => {
          paymentMethodDistribution[nm.paymentMethod] =
            (paymentMethodDistribution[nm.paymentMethod] || 0) + 1;
        });

        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Payment Method Distribution", this.margin, doc.y);
        doc.moveDown(0.5);

        if (Object.keys(paymentMethodDistribution).length > 0) {
          this.addProfessionalTable(
            doc,
            ["Payment Method", "Count"],
            Object.entries(paymentMethodDistribution).map(([method, count]) => [
              method,
              count.toString(),
            ])
          );
        } else {
          doc
            .fontSize(12)
            .font("Helvetica")
            .fillColor("#666666")
            .text("No payment method data available.", this.margin, doc.y);
          doc.moveDown(1);
        }

        doc.moveDown(1);

        // Walk-in Customer Details
        if (validatedNonMembers.length > 0) {
          if (doc.y > 500) doc.addPage();

          doc
            .fontSize(14)
            .font("Helvetica-Bold")
            .fillColor("#2c5aa0")
            .text("Walk-in Customer Details", this.margin, doc.y);
          doc.moveDown(0.5);

          this.addProfessionalTable(
            doc,
            [
              "Name",
              "Phone",
              "Email",
              "Amount",
              "Payment Method",
              "Check-in Time",
            ],
            validatedNonMembers.map((nm) => [
              this.truncateText(`${nm.firstName} ${nm.lastName}`, 20),
              this.truncateText(nm.phone, 15),
              this.truncateText(nm.email, 20),
              `₱${nm.amount.toLocaleString()}`,
              this.truncateText(nm.paymentMethod, 15),
              nm.checkInTime.toLocaleString(),
            ])
          );
        } else {
          doc
            .fontSize(12)
            .font("Helvetica")
            .fillColor("#666666")
            .text(
              "No walk-in customer data available for the selected period.",
              this.margin,
              doc.y
            );
          doc.moveDown(1);
        }

        this.addFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Generate Membership Report
  async generateMembershipReport(memberships, users, period = "all") {
    return new Promise((resolve, reject) => {
      try {
        if (!Array.isArray(memberships)) {
          throw new Error("Memberships must be an array");
        }

        const doc = new PDFDocument({ margin: this.margin, size: "letter" });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const filtered = this.filterByPeriod(memberships, period);
        const validatedMemberships = filtered.map((m) =>
          this.validateMembershipData(m)
        );

        this.addHeader(doc, "Membership Report", period);

        // Membership Statistics
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Membership Statistics", this.margin, doc.y);
        doc.moveDown(0.5);

        const stats = [
          ["Total Memberships:", validatedMemberships.length],
          [
            "Active:",
            validatedMemberships.filter((m) => m.status === "Active").length,
          ],
          [
            "Pending:",
            validatedMemberships.filter((m) => m.status === "Pending").length,
          ],
          [
            "Expired:",
            validatedMemberships.filter((m) => new Date(m.endDate) < new Date())
              .length,
          ],
        ];

        stats.forEach(([label, value]) => {
          doc
            .font("Helvetica-Bold")
            .fillColor("#333333")
            .text(label, { continued: true })
            .font("Helvetica")
            .fillColor("#000000")
            .text(` ${value}`);
        });

        doc.moveDown(1.5);

        // Plan Distribution
        const planDistribution = {};
        validatedMemberships.forEach((m) => {
          planDistribution[m.planType] =
            (planDistribution[m.planType] || 0) + 1;
        });

        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Plan Distribution", this.margin, doc.y);
        doc.moveDown(0.5);

        if (Object.keys(planDistribution).length > 0) {
          this.addProfessionalTable(
            doc,
            ["Plan Type", "Members"],
            Object.entries(planDistribution).map(([plan, count]) => [
              plan,
              count.toString(),
            ])
          );
        } else {
          doc
            .fontSize(12)
            .font("Helvetica")
            .fillColor("#666666")
            .text("No plan distribution data available.", this.margin, doc.y);
          doc.moveDown(1);
        }

        doc.moveDown(1);

        // Active Members
        const activeMembers = validatedMemberships.filter(
          (m) => m.status === "Active"
        );
        if (activeMembers.length > 0) {
          if (doc.y > 500) doc.addPage();

          doc
            .fontSize(14)
            .font("Helvetica-Bold")
            .fillColor("#2c5aa0")
            .text("Active Members", this.margin, doc.y);
          doc.moveDown(0.5);

          this.addProfessionalTable(
            doc,
            ["Name", "Email", "Plan", "Start Date"],
            activeMembers.map((m) => [
              this.truncateText(`${m.firstName} ${m.lastName}`, 20),
              this.truncateText(m.email, 25),
              m.planType,
              m.startDate.toLocaleDateString(),
            ])
          );
        }

        this.addFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Generate Check-in Report (removed unused memberships parameter)
  async generateCheckInReport(checkins, period = "all") {
    return new Promise((resolve, reject) => {
      try {
        if (!Array.isArray(checkins)) {
          throw new Error("Checkins must be an array");
        }

        const doc = new PDFDocument({ margin: this.margin, size: "letter" });
        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const filtered = this.filterByPeriod(checkins, period, "checkinTime");
        const validatedCheckins = filtered.map((c) =>
          this.validateCheckinData(c)
        );

        this.addHeader(doc, "Check-in Report", period);

        // Check-in Statistics
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Check-in Statistics", this.margin, doc.y);
        doc.moveDown(0.5);

        const uniqueMembers = [
          ...new Set(validatedCheckins.map((c) => c.userId.toString())),
        ].length;
        const today = new Date();
        const todayCheckins = validatedCheckins.filter(
          (c) => c.checkinTime.toDateString() === today.toDateString()
        ).length;

        const stats = [
          ["Total Check-ins:", validatedCheckins.length],
          ["Unique Members:", uniqueMembers],
          ["Today's Check-ins:", todayCheckins],
        ];

        stats.forEach(([label, value]) => {
          doc
            .font("Helvetica-Bold")
            .fillColor("#333333")
            .text(label, { continued: true })
            .font("Helvetica")
            .fillColor("#000000")
            .text(` ${value}`);
        });

        doc.moveDown(1.5);

        // Recent Check-ins
        const recentCheckins = validatedCheckins
          .sort((a, b) => b.checkinTime - a.checkinTime)
          .slice(0, 20);

        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#2c5aa0")
          .text("Recent Check-ins", this.margin, doc.y);
        doc.moveDown(0.5);

        if (recentCheckins.length > 0) {
          this.addProfessionalTable(
            doc,
            ["Member", "Plan", "Check-in Time", "Checked-in By"],
            recentCheckins.map((c) => [
              this.truncateText(`${c.firstName} ${c.lastName}`, 20),
              c.planType,
              c.checkinTime.toLocaleString(),
              c.checkedInBy.adminName || "System",
            ])
          );
        } else {
          doc
            .fontSize(12)
            .font("Helvetica")
            .fillColor("#666666")
            .text("No check-in data available.", this.margin, doc.y);
          doc.moveDown(1);
        }

        this.addFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---- PROFESSIONAL HEADER ----
  addHeader(doc, title, period) {
    // Header background
    doc.rect(0, 0, this.pageWidth, 100).fill("#2c5aa0");

    // Title
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(title, this.margin, 40);

    // Period and date
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#ffffff")
      .text(`Period: ${this.getPeriodDisplay(period)}`, this.margin, 70)
      .text(`Generated: ${new Date().toLocaleDateString()}`, this.margin, 85);

    // Gym info
    doc
      .text("Tough Athletics Gym", this.pageWidth - this.margin - 150, 70, {
        align: "right",
      })
      .text(
        "Professional Fitness Center",
        this.pageWidth - this.margin - 150,
        85,
        { align: "right" }
      );

    doc.y = 120;
  }

  // ---- PROFESSIONAL TABLE WITH BORDERS ----
  addProfessionalTable(doc, headers, rows) {
    if (rows.length === 0) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666666")
        .text("No data available", this.margin, doc.y);
      doc.moveDown(1);
      return;
    }

    const colCount = headers.length;
    const rowHeight = 20;
    const headerHeight = 25;

    // Calculate column widths (equal distribution)
    const colWidth = this.contentWidth / colCount;
    let startY = doc.y;

    // Check if we need a new page
    if (
      startY + headerHeight + rows.length * rowHeight >
      this.pageHeight - 100
    ) {
      doc.addPage();
      startY = this.margin;
    }

    // Draw table header
    doc
      .rect(this.margin, startY, this.contentWidth, headerHeight)
      .fill("#2c5aa0");

    headers.forEach((header, i) => {
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#ffffff")
        .text(header, this.margin + colWidth * i + 5, startY + 8, {
          width: colWidth - 10,
          align: "left",
        });

      // Vertical line
      if (i < colCount - 1) {
        doc
          .moveTo(this.margin + colWidth * (i + 1), startY)
          .lineTo(this.margin + colWidth * (i + 1), startY + headerHeight)
          .strokeColor("#ffffff")
          .stroke();
      }
    });

    // Outer border for header
    doc
      .rect(this.margin, startY, this.contentWidth, headerHeight)
      .stroke("#2c5aa0");

    let currentY = startY + headerHeight;

    // Draw table rows
    rows.forEach((row, rowIndex) => {
      // Check for page break
      if (currentY + rowHeight > this.pageHeight - 100) {
        doc.addPage();
        currentY = this.margin;

        // Redraw header on new page
        doc
          .rect(this.margin, currentY, this.contentWidth, headerHeight)
          .fill("#2c5aa0");
        headers.forEach((header, i) => {
          doc
            .fontSize(9)
            .font("Helvetica-Bold")
            .fillColor("#ffffff")
            .text(header, this.margin + colWidth * i + 5, currentY + 8, {
              width: colWidth - 10,
              align: "left",
            });
        });
        doc
          .rect(this.margin, currentY, this.contentWidth, headerHeight)
          .stroke("#2c5aa0");
        currentY += headerHeight;
      }

      // Row background (alternating)
      const bgColor = rowIndex % 2 === 0 ? "#ffffff" : "#f8f9fa";
      doc
        .rect(this.margin, currentY, this.contentWidth, rowHeight)
        .fill(bgColor);

      // Row data
      row.forEach((cell, colIndex) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#000000")
          .text(cell, this.margin + colWidth * colIndex + 5, currentY + 6, {
            width: colWidth - 10,
            align: "left",
          });

        // Vertical line
        if (colIndex < colCount - 1) {
          doc
            .moveTo(this.margin + colWidth * (colIndex + 1), currentY)
            .lineTo(
              this.margin + colWidth * (colIndex + 1),
              currentY + rowHeight
            )
            .strokeColor("#dddddd")
            .stroke();
        }
      });

      // Horizontal line
      doc
        .moveTo(this.margin, currentY + rowHeight)
        .lineTo(this.pageWidth - this.margin, currentY + rowHeight)
        .strokeColor("#dddddd")
        .stroke();

      currentY += rowHeight;
    });

    // Outer table border
    doc
      .rect(this.margin, startY, this.contentWidth, currentY - startY)
      .stroke("#000000");

    doc.y = currentY + 10;
  }

  // ---- PROFESSIONAL FOOTER ----
  addFooter(doc) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 40;

    // Footer line
    doc
      .moveTo(this.margin, footerY - 10)
      .lineTo(this.pageWidth - this.margin, footerY - 10)
      .strokeColor("#dddddd")
      .stroke();

    // Footer text
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#666666")
      .text(
        "Tough Athletics Gym - Confidential Business Report",
        this.margin,
        footerY
      )
      .text(
        `Page ${doc.bufferedPageRange().count}`,
        this.pageWidth - this.margin - 50,
        footerY,
        { align: "right" }
      );
  }

  // ---- DATE FILTERING ----
  filterByPeriod(data, period, dateField = "createdAt") {
    if (period === "all") return data;
    const now = new Date();
    let start;

    switch (period) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        start = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        return data;
    }
    return data.filter((i) => {
      const itemDate = new Date(i[dateField]);
      return itemDate >= start;
    });
  }

  getPeriodDisplay(period) {
    return (
      {
        today: "Today",
        week: "Last 7 Days",
        month: "Last 30 Days",
        year: "Last Year",
        all: "All Time",
      }[period] || "All Time"
    );
  }
}

module.exports = PDFGenerator;
