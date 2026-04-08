import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

const outputDir = path.resolve(process.cwd(), "public/test-docs");
fs.mkdirSync(outputDir, { recursive: true });

const vendor = {
  name: "Northlight Culinary Studio",
  contact: "Maya Patel",
  email: "maya@northlightculinary.com",
  phone: "(555) 014-7712",
};

const project = {
  campaign: "Spring Produce Hero Shoot",
  wf: "WF-24017",
};

const estimateItems = [
  { description: "Food styling lead day rate (2 shoot days)", qty: 2, unit: 2200 },
  { description: "Assistant food stylist (2 shoot days)", qty: 2, unit: 1100 },
  { description: "Prop purchases + rentals", qty: 1, unit: 1750 },
  { description: "Studio kitchen rental", qty: 1, unit: 4800 },
  { description: "Post-production color + retouch", qty: 1, unit: 2600 },
  { description: "Travel + parking", qty: 1, unit: 450 },
  { description: "Catering for crew", qty: 1, unit: 1250 },
  { description: "Production expendables", qty: 1, unit: 1000 },
];

const invoiceUnderItems = [
  { description: "Food styling lead day rate", amount: 4400 },
  { description: "Assistant food stylist", amount: 2100 },
  { description: "Prop purchases + rentals", amount: 1650 },
  { description: "Studio kitchen rental", amount: 4800 },
  { description: "Post-production color + retouch", amount: 2500 },
  { description: "Travel + parking", amount: 400 },
  { description: "Catering for crew", amount: 1250 },
  { description: "Production expendables", amount: 1000 },
];

const invoiceOverItems = [
  { description: "Food styling lead day rate + overtime", amount: 4800 },
  { description: "Assistant food stylist", amount: 2400 },
  { description: "Prop purchases + rentals", amount: 2050 },
  { description: "Studio kitchen rental", amount: 4800 },
  { description: "Post-production color + retouch", amount: 3100 },
  { description: "Travel + parking", amount: 500 },
  { description: "Catering for crew", amount: 1300 },
  { description: "Production expendables + rush restock", amount: 1300 },
];

function money(value) {
  return `$${value.toFixed(2)}`;
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function save(doc, fileName) {
  const bytes = doc.output("arraybuffer");
  fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(bytes));
}

function docShell(title) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(title, 42, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${project.wf}  |  ${project.campaign}`, 42, 66);
  doc.text(`Generated for local workflow testing on 2026-04-08`, 42, 80);

  doc.setDrawColor(210);
  doc.line(42, 92, pageWidth - 42, 92);

  return doc;
}

function drawVendorBlock(doc) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Vendor", 42, 114);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(vendor.name, 42, 128);
  doc.text(vendor.contact, 42, 142);
  doc.text(vendor.email, 42, 156);
  doc.text(vendor.phone, 42, 170);
}

function drawMetaBlock(doc, pairs) {
  const x = 330;
  let y = 114;

  for (const [label, value] of pairs) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, x, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(value, x, y + 14);

    y += 34;
  }
}

function drawEstimateTable(doc, items, startY) {
  let y = startY;
  const headers = ["Description", "Qty", "Unit", "Amount"];
  const columns = [42, 330, 390, 470];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  headers.forEach((header, index) => doc.text(header, columns[index], y));

  y += 9;
  doc.setDrawColor(210);
  doc.line(42, y, 570, y);

  y += 16;
  doc.setFont("helvetica", "normal");

  for (const item of items) {
    const amount = item.qty * item.unit;
    doc.text(item.description, 42, y);
    doc.text(String(item.qty), 330, y);
    doc.text(money(item.unit), 390, y);
    doc.text(money(amount), 470, y);
    y += 18;
  }

  return y;
}

function drawInvoiceTable(doc, items, startY) {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Description", 42, y);
  doc.text("Amount", 470, y);

  y += 9;
  doc.setDrawColor(210);
  doc.line(42, y, 570, y);

  y += 16;
  doc.setFont("helvetica", "normal");

  for (const item of items) {
    doc.text(item.description, 42, y);
    doc.text(money(item.amount), 470, y);
    y += 18;
  }

  return y;
}

function drawTotal(doc, label, total, y) {
  doc.setDrawColor(210);
  doc.line(42, y, 570, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${label}: ${money(total)}`, 390, y);
  return y;
}

function drawNote(doc, text, y) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, 520);
  doc.text(lines, 42, y);
}

function createEstimate() {
  const doc = docShell("ESTIMATE");
  drawVendorBlock(doc);
  drawMetaBlock(doc, [
    ["Estimate #", "EST-WF-24017-001"],
    ["Estimate Date", "2026-04-08"],
    ["Terms", "Net 30 after invoice approval"],
  ]);

  let y = drawEstimateTable(doc, estimateItems, 210);
  const total = sum(estimateItems.map((item) => item.qty * item.unit));
  y = drawTotal(doc, "Total Estimate", total, y + 2);

  drawNote(
    doc,
    "Test intent: baseline approved estimate total for PO and invoice cap checks.",
    y + 22
  );

  save(doc, "estimate-approved-northlight.pdf");
}

function createPO() {
  const doc = docShell("PURCHASE ORDER");
  drawVendorBlock(doc);
  drawMetaBlock(doc, [
    ["PO #", "PO-WF-24017-001"],
    ["PO Date", "2026-04-09"],
    ["Status", "Issued"],
  ]);

  let y = drawEstimateTable(doc, estimateItems, 210);
  const total = sum(estimateItems.map((item) => item.qty * item.unit));
  y = drawTotal(doc, "Total Authorized", total, y + 2);

  drawNote(
    doc,
    "Authorization note: vendor may invoice up to the approved PO total only.",
    y + 22
  );

  save(doc, "po-issued-northlight.pdf");
}

function createSignedPO() {
  const doc = docShell("PURCHASE ORDER (SIGNED COPY)");
  drawVendorBlock(doc);
  drawMetaBlock(doc, [
    ["PO #", "PO-WF-24017-001"],
    ["PO Date", "2026-04-09"],
    ["Signed Date", "2026-04-10"],
  ]);

  let y = drawEstimateTable(doc, estimateItems, 210);
  const total = sum(estimateItems.map((item) => item.qty * item.unit));
  y = drawTotal(doc, "Total Authorized", total, y + 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Vendor Signature", 42, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Maya Patel", 42, y + 52);
  doc.text("Digitally signed for workflow testing", 42, y + 68);

  save(doc, "po-signed-northlight.pdf");
}

function createInvoice(fileName, invoiceNumber, invoiceDate, items, intentNote) {
  const doc = docShell("INVOICE");
  drawVendorBlock(doc);
  drawMetaBlock(doc, [
    ["Invoice #", invoiceNumber],
    ["Invoice Date", invoiceDate],
    ["PO Ref", "PO-WF-24017-001"],
  ]);

  let y = drawInvoiceTable(doc, items, 210);
  const total = sum(items.map((item) => item.amount));
  y = drawTotal(doc, "Total Amount Due", total, y + 2);

  drawNote(doc, intentNote, y + 22);

  save(doc, fileName);
}

function createManifest() {
  const manifest = {
    generatedAt: "2026-04-08",
    campaign: project,
    vendor,
    docs: [
      {
        file: "estimate-approved-northlight.pdf",
        use: "Upload as estimate file; set estimate total to 18450.",
        total: 18450,
      },
      {
        file: "po-issued-northlight.pdf",
        use: "Upload/send as PO document after estimate approval.",
        total: 18450,
      },
      {
        file: "po-signed-northlight.pdf",
        use: "Reference signed PO artifact.",
        total: 18450,
      },
      {
        file: "invoice-under-cap-northlight.pdf",
        use: "Upload as valid invoice (below approved PO total).",
        total: 18100,
      },
      {
        file: "invoice-over-cap-northlight.pdf",
        use: "Upload to test over-budget flagging (above approved PO total).",
        total: 20250,
      },
    ],
  };

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

createEstimate();
createPO();
createSignedPO();
createInvoice(
  "invoice-under-cap-northlight.pdf",
  "INV-WF-24017-014",
  "2026-04-16",
  invoiceUnderItems,
  "Test intent: should pass invoice <= approved estimate/PO total guardrail."
);
createInvoice(
  "invoice-over-cap-northlight.pdf",
  "INV-WF-24017-015",
  "2026-04-17",
  invoiceOverItems,
  "Test intent: intentionally exceeds approved estimate/PO total to validate alerts and rejection flow."
);
createManifest();

console.log(`Generated test documents in ${outputDir}`);
