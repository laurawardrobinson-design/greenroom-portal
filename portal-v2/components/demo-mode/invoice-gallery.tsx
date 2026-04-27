"use client";

import { useState } from "react";
import { Download, Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  generateInvoicePdf,
  InvoicePdfOptions,
  InvoiceItem,
} from "@/lib/utils/pdf-generator";

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorContact: string;
  vendorEmail: string;
  vendorPhone: string;
  campaignWF: string;
  campaignName: string;
  invoiceDate: string;
  totalAmount: number;
  status: "Pending" | "Approved" | "Paid" | "Rejected";
  items: InvoiceItem[];
}

const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv-001",
    invoiceNumber: "INV-2026-047",
    vendorName: "Post Production Masters",
    vendorContact: "David Wu",
    vendorEmail: "david@postmasters.demo",
    vendorPhone: "(212) 555-0105",
    campaignWF: "WF210501",
    campaignName: "Organic Produce Campaign",
    invoiceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 3200,
    status: "Approved",
    items: [
      { description: "Image retouching (120 images)", amount: 3000 },
      { description: "Color grading", amount: 200 },
    ],
  },
  {
    id: "inv-002",
    invoiceNumber: "INV-KIM-0156",
    vendorName: "Set Dressing Pro LLC",
    vendorContact: "James Kim",
    vendorEmail: "james@setdressingpro.demo",
    vendorPhone: "(212) 555-0104",
    campaignWF: "WF210601",
    campaignName: "Holiday Promotion 2026",
    invoiceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 8200,
    status: "Pending",
    items: [
      { description: "Prop sourcing and rentals", amount: 5000 },
      { description: "Set dressing labor (3 days)", amount: 3000 },
      { description: "Delivery and setup", amount: 200 },
    ],
  },
  {
    id: "inv-003",
    invoiceNumber: "INV-CHEN-2045",
    vendorName: "Sarah Chen Photography",
    vendorContact: "Sarah Chen",
    vendorEmail: "sarah@chenphoto.demo",
    vendorPhone: "(212) 555-0102",
    campaignWF: "WF210301",
    campaignName: "Plant-Based Meat Showcase",
    invoiceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 5200,
    status: "Approved",
    items: [
      { description: "Lead photography (1 day)", amount: 3000 },
      { description: "Assistant", amount: 600 },
      { description: "Travel and meals", amount: 1600 },
    ],
  },
];

const STATUS_CONFIG: {
  [key: string]: { color: string; icon: React.ReactNode; label: string };
} = {
  Pending: {
    color: "bg-yellow-100 text-yellow-800",
    icon: <Clock className="h-4 w-4" />,
    label: "Pending",
  },
  Approved: {
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Approved",
  },
  Paid: {
    color: "bg-blue-100 text-blue-800",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Paid",
  },
  Rejected: {
    color: "bg-red-100 text-red-800",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Rejected",
  },
};

export function InvoiceGallery() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const downloadPDF = (invoice: Invoice) => {
    const options: InvoicePdfOptions = {
      vendorName: invoice.vendorName,
      vendorContact: invoice.vendorContact,
      vendorEmail: invoice.vendorEmail,
      vendorPhone: invoice.vendorPhone,
      campaignName: invoice.campaignName,
      wfNumber: invoice.campaignWF,
      invoiceDate: invoice.invoiceDate,
      invoiceNumber: invoice.invoiceNumber,
      items: invoice.items,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      notes: "Thank you for your partnership.",
    };

    const pdf = generateInvoicePdf(options);
    pdf.save(`${invoice.invoiceNumber}-${invoice.vendorName}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_INVOICES.map((invoice) => {
          const config = STATUS_CONFIG[invoice.status];
          return (
            <div
              key={invoice.id}
              className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedInvoice(invoice)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary">
                    {invoice.invoiceNumber}
                  </h3>
                  <p className="text-sm text-text-secondary">{invoice.vendorName}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                  {config.icon}
                  {config.label}
                </div>
              </div>

              <div className="mb-4 pb-4 border-b border-border">
                <p className="text-xs text-text-secondary mb-1">
                  {invoice.campaignWF} {invoice.campaignName}
                </p>
                <p className="text-lg font-semibold text-primary">
                  ${invoice.totalAmount.toLocaleString()}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadPDF(invoice);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Invoice
              </button>
            </div>
          );
        })}
      </div>

      {selectedInvoice && (
        <div className="mt-6 p-4 bg-bg-secondary rounded-lg border border-border">
          <h3 className="font-semibold text-text-primary mb-3">
            {selectedInvoice.invoiceNumber} Details
          </h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              <span className="font-medium">Vendor:</span> {selectedInvoice.vendorName}
            </p>
            <p>
              <span className="font-medium">Contact:</span> {selectedInvoice.vendorContact}
            </p>
            <p>
              <span className="font-medium">Campaign:</span> {selectedInvoice.campaignWF} -{" "}
              {selectedInvoice.campaignName}
            </p>
            <p>
              <span className="font-medium">Total Amount:</span> $
              {selectedInvoice.totalAmount.toLocaleString()}
            </p>
            <p>
              <span className="font-medium">Status:</span>{" "}
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  STATUS_CONFIG[selectedInvoice.status].color
                }`}
              >
                {selectedInvoice.status}
              </span>
            </p>
            <p>
              <span className="font-medium">Items:</span>{" "}
              {selectedInvoice.items.length} line items
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
