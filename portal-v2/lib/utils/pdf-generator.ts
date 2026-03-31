import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { CallSheetData } from "@/types/domain";

// ─── Call Sheet PDF ──────────────────────────────────────────────────────────
// Matches the existing Word template layout:
// Company header | Date + Crew Call | Weather
// Location | Emergency Info | Job Number
// Crew Contacts table
// Talent table
// Safety reminders

interface CallSheetPdfOptions extends CallSheetData {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  producerEmail?: string;
  emergencyHospital?: string;
  emergencyAddress?: string;
  emergencyPhone?: string;
  parkingDirections?: string;
  weatherNotes?: string;
  specialInstructions?: string;
  safetyReminders?: string;
  dayNumber?: number;
  totalDays?: number;
}

const SAFETY_DEFAULT =
  "Safety Reminders:\n" +
  "Always wear closed toe shoes.\n" +
  "Dress for EXT or INT shoots with safety in mind.\n" +
  "Review call sheets for safety information.\n" +
  "Know where the first aid kit is located (ask the producer).\n" +
  "Be mindful of common production hazards:\n" +
  "  Tripping (wires, cables, boxes)\n" +
  "  Falling Objects (lighting, flags, stands)\n" +
  "  Electrical (breakout boxes and high voltage cabling)\n" +
  "  Vehicles\n" +
  "  Water";

export function generateCallSheetPdf(options: CallSheetPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentW = pageW - margin * 2;
  let y = margin;

  // --- Helper ---
  const drawLine = (yPos: number) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageW - margin, yPos);
  };

  const dateStr = options.shootDate
    ? format(parseISO(options.shootDate), "EEEE\nMMMM d, yyyy").toUpperCase()
    : "DATE TBD";

  const dayLabel = options.dayNumber && options.totalDays
    ? `Day ${options.dayNumber} of ${options.totalDays}`
    : "";

  // ═══ HEADER ROW ═══
  // Left: Company info | Center: Date + Crew Call | Right: Weather
  const colW = contentW / 3;

  // Company info (left)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const company = options.companyName || "Publix Corporate";
  const addr = options.companyAddress || "3300 Publix Corporate Pkwy\nLakeland, FL 33811\n863-688-1188";
  const contactNote = "Please contact Producer with any dietary restrictions";
  const producerLine = options.producer
    ? `${options.producer.email}\n${options.producer.phone}`
    : options.producerEmail || "";

  doc.text(company, margin, y + 10);
  doc.setFontSize(7);
  doc.text(addr, margin, y + 22, { maxWidth: colW - 8 });
  doc.text(contactNote, margin, y + 56, { maxWidth: colW - 8 });
  if (producerLine) {
    doc.text(producerLine, margin, y + 72, { maxWidth: colW - 8 });
  }

  // Date + Crew call (center)
  const cx = margin + colW;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(dateStr, cx + colW / 2, y + 14, { align: "center" });
  if (dayLabel) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(dayLabel, cx + colW / 2, y + 38, { align: "center" });
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const crewCall = options.callTime || "TBD";
  doc.text(`CREW CALL: ${crewCall}`, cx + colW / 2, y + 52, { align: "center" });

  // Weather (right)
  const rx = margin + colW * 2;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Weather", rx, y + 10);
  if (options.weatherNotes) {
    doc.text(options.weatherNotes, rx, y + 22, { maxWidth: colW - 8 });
  }

  y += 90;
  drawLine(y);
  y += 8;

  // ═══ LOCATION / EMERGENCY / JOB ROW ═══
  // Location (left)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Shoot Location", margin, y + 10);
  doc.setFont("helvetica", "normal");
  const locText = options.location || "TBD";
  doc.text(locText, margin, y + 22, { maxWidth: colW - 8 });
  if (options.parkingDirections) {
    doc.text(options.parkingDirections, margin, y + 46, { maxWidth: colW - 8 });
  }

  // Emergency (center)
  doc.setFont("helvetica", "bold");
  doc.text("Emergency Information", cx, y + 10);
  doc.setFont("helvetica", "normal");
  doc.text("Dial 911 for Emergency", cx, y + 22);
  const hospital = options.emergencyHospital || "";
  const hospAddr = options.emergencyAddress || "";
  const hospPhone = options.emergencyPhone || "";
  if (hospital) doc.text(`Hospital: ${hospital}`, cx, y + 36, { maxWidth: colW - 8 });
  if (hospAddr) doc.text(hospAddr, cx, y + 48, { maxWidth: colW - 8 });
  if (hospPhone) doc.text(hospPhone, cx, y + 66);

  // Job number (right)
  doc.setFont("helvetica", "bold");
  doc.text("Job Number", rx, y + 10);
  doc.setFont("helvetica", "normal");
  doc.text(`${options.wfNumber} ${options.campaignName}`, rx, y + 22, { maxWidth: colW - 8 });
  doc.text("Send invoices to:", rx, y + 42);
  doc.text("Production@publix.com", rx, y + 54);

  y += 80;
  drawLine(y);
  y += 12;

  // ═══ CREW CONTACTS TABLE ═══
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Crew Contacts", margin, y);
  y += 6;

  const crewRows: string[][] = [];
  // Add producer first
  if (options.producer) {
    crewRows.push([
      "Producer",
      options.producer.name,
      `${options.producer.email}\n${options.producer.phone}`,
      options.callTime ? (options.callTime.replace(/:00$/, ":00 AM")).replace(/^(\d):/, "0$1:") : "",
      "",
    ]);
  }
  for (const c of options.crew) {
    crewRows.push([
      c.role,
      c.name,
      c.phone ? `${c.email}\n${c.phone}` : c.email || "reach out to producer for contact",
      c.callTime || options.callTime || "",
      "",
    ]);
  }
  // Add vendors as crew entries
  for (const v of options.vendors.filter(v => v.role?.toLowerCase() !== "talent")) {
    crewRows.push([
      v.role || v.company,
      v.contact || v.company,
      v.phone ? `${v.email}\n${v.phone}` : v.email,
      options.callTime || "",
      "",
    ]);
  }

  if (crewRows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Title", "Name", "Contact", "Call Time", "Other"]],
      body: crewRows,
      theme: "grid",
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 100 },
        2: { cellWidth: 140 },
        3: { cellWidth: 60 },
        4: { cellWidth: contentW - 390 },
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // ═══ TALENT TABLE ═══
  const talentVendors = options.vendors.filter(v => v.role?.toLowerCase() === "talent");
  if (talentVendors.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Talent", margin, y);
    y += 6;

    const talentRows = talentVendors.map((t) => [
      "Talent",
      t.contact || t.company,
      t.phone ? `${t.email}\n${t.phone}` : t.email,
      options.callTime || "",
      t.company || "",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Role", "Name", "Contact", "Call Time", "Other"]],
      body: talentRows,
      theme: "grid",
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 100 },
        2: { cellWidth: 140 },
        3: { cellWidth: 60 },
        4: { cellWidth: contentW - 390 },
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // ═══ SPECIAL INSTRUCTIONS ═══
  if (options.specialInstructions) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Special Instructions", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(options.specialInstructions, margin, y + 12, { maxWidth: contentW });
    y += 12 + doc.getTextDimensions(options.specialInstructions, { maxWidth: contentW }).h + 8;
  }

  // ═══ SAFETY REMINDERS ═══
  // Check if we need a new page
  if (y > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage();
    y = margin;
  }

  drawLine(y);
  y += 8;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const safety = options.safetyReminders || SAFETY_DEFAULT;
  doc.text(safety, margin, y, { maxWidth: contentW });

  return doc;
}

// ─── Shot List PDF ───────────────────────────────────────────────────────────
// Clean table matching the Excel template column order

interface ShotListPdfRow {
  shotNumber: number | string;
  fileName: string;
  fileType: string;
  angle: string;
  ratio: string;
  environment: string;
  description: string;
  products: string;
  talent: string;
  channel: string;
  notes: string;
}

interface ShotListPdfOptions {
  campaignName: string;
  wfNumber: string;
  deliveryDate?: string;
  rows: ShotListPdfRow[];
}

export function generateShotListPdf(options: ShotListPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const margin = 28;

  // Header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${options.wfNumber} ${options.campaignName}`, margin, margin + 10);
  if (options.deliveryDate) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Asset Delivery: ${format(parseISO(options.deliveryDate), "M/d/yy")}`,
      doc.internal.pageSize.getWidth() - margin,
      margin + 10,
      { align: "right" }
    );
  }

  // Table
  const body = options.rows.map((r) => [
    String(r.shotNumber),
    r.fileName,
    r.fileType,
    r.angle,
    r.ratio,
    r.environment,
    r.description,
    r.products,
    r.talent,
    r.channel,
    r.notes,
  ]);

  autoTable(doc, {
    startY: margin + 22,
    margin: { left: margin, right: margin },
    head: [["Shot #", "Shot List", "File Type", "Angle", "Ratio", "Environment", "Description", "Product Name & Item Code", "Talent", "Channel", "Notes"]],
    body,
    theme: "grid",
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 6, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 30 },    // Shot #
      1: { cellWidth: 120 },   // File name
      2: { cellWidth: 35 },    // File Type
      3: { cellWidth: 45 },    // Angle
      4: { cellWidth: 50 },    // Ratio
      5: { cellWidth: 65 },    // Environment
      6: { cellWidth: 120 },   // Description
      7: { cellWidth: 100 },   // Products
      8: { cellWidth: 30 },    // Talent
      9: { cellWidth: 70 },    // Channel
      10: { cellWidth: 80 },   // Notes
    },
  });

  return doc;
}

// ─── One-Liner / Daily Schedule PDF ──────────────────────────────────────────
// Strip-board format with setup color bands

interface OneLinerRow {
  shotNumber: number | string;
  description: string;
  products: string;
  environment: string;
  channels: string;
  timeEst: string;
  notes: string;
  setupName: string;
}

interface OneLinerPdfOptions {
  campaignName: string;
  wfNumber: string;
  shootDate: string;
  callTime?: string;
  location?: string;
  dayNumber?: number;
  totalDays?: number;
  rows: OneLinerRow[];
}

// Muted pastel colors for setup bands (RGB arrays)
const SETUP_COLORS: [number, number, number][] = [
  [255, 243, 224], // amber-50
  [224, 242, 254], // blue-50
  [252, 231, 243], // rose-50
  [236, 253, 245], // emerald-50
  [245, 243, 255], // violet-50
  [254, 249, 195], // yellow-50
  [255, 237, 213], // orange-50
  [219, 234, 254], // sky-50
];

export function generateOneLinerPdf(options: OneLinerPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const margin = 28;
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const dayLabel = options.dayNumber && options.totalDays
    ? ` — Day ${options.dayNumber} of ${options.totalDays}`
    : "";
  doc.text(`${options.wfNumber} ${options.campaignName}${dayLabel}`, margin, margin + 10);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const dateStr = options.shootDate
    ? format(parseISO(options.shootDate), "EEEE, MMMM d, yyyy")
    : "Date TBD";
  const callStr = options.callTime ? ` | Crew Call: ${options.callTime}` : "";
  const locStr = options.location ? ` | ${options.location}` : "";
  doc.text(`${dateStr}${callStr}${locStr}`, margin, margin + 24);

  doc.text("ONE-LINER / DAILY SCHEDULE", pageW - margin, margin + 10, { align: "right" });

  // Build setup color map
  const setupNames = [...new Set(options.rows.map((r) => r.setupName))];
  const setupColorMap = new Map<string, [number, number, number]>();
  setupNames.forEach((name, i) => {
    setupColorMap.set(name, SETUP_COLORS[i % SETUP_COLORS.length]);
  });

  // Table
  const body = options.rows.map((r) => [
    String(r.shotNumber),
    r.description,
    r.products,
    r.environment,
    r.channels,
    r.timeEst,
    r.notes,
  ]);

  autoTable(doc, {
    startY: margin + 36,
    margin: { left: margin, right: margin },
    head: [["Shot", "Description", "Products", "Surface / Environment", "Channels", "Est. Time", "Notes"]],
    body,
    theme: "grid",
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 7, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 160 },
      2: { cellWidth: 120 },
      3: { cellWidth: 100 },
      4: { cellWidth: 90 },
      5: { cellWidth: 55 },
      6: { cellWidth: pageW - margin * 2 - 560 },
    },
    didParseCell(data) {
      if (data.section === "body") {
        const row = options.rows[data.row.index];
        if (row) {
          const color = setupColorMap.get(row.setupName);
          if (color) {
            data.cell.styles.fillColor = color;
          }
        }
      }
    },
  });

  return doc;
}
