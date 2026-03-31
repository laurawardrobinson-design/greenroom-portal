"use client";

import { useState } from "react";
import { Download, CheckCircle } from "lucide-react";
import { generatePOPdf, POPdfOptions, POItem } from "@/lib/utils/pdf-generator";

interface PO {
  id: string;
  poNumber: string;
  vendorName: string;
  vendorContact: string;
  vendorEmail: string;
  vendorPhone: string;
  campaignWF: string;
  campaignName: string;
  poDate: string;
  totalAmount: number;
  items: POItem[];
}

const MOCK_POS: PO[] = [
  {
    id: "po-001",
    poNumber: "PO-2026-001",
    vendorName: "Lightbox Studios Inc.",
    vendorContact: "Marcus Thompson",
    vendorEmail: "marcus@lightboxstudios.demo",
    vendorPhone: "(212) 555-0101",
    campaignWF: "WF210501",
    campaignName: "Organic Produce Campaign",
    poDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 8500,
    items: [
      {
        description: "Studio rental - 2 full days",
        quantity: 2,
        unitPrice: 2500,
        amount: 5000,
      },
      {
        description: "Lighting kit and grip package",
        quantity: 1,
        unitPrice: 2000,
        amount: 2000,
      },
      {
        description: "Gaffer and grip crew (2 people)",
        quantity: 2,
        unitPrice: 750,
        amount: 1500,
      },
    ],
  },
  {
    id: "po-002",
    poNumber: "PO-2026-002",
    vendorName: "Sarah Chen Photography",
    vendorContact: "Sarah Chen",
    vendorEmail: "sarah@chenphoto.demo",
    vendorPhone: "(212) 555-0102",
    campaignWF: "WF210601",
    campaignName: "Holiday Promotion 2026",
    poDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 14500,
    items: [
      {
        description: "Lead photographer, 3-day shoot",
        quantity: 3,
        unitPrice: 3500,
        amount: 10500,
      },
      {
        description: "Assistant photographer",
        quantity: 3,
        unitPrice: 700,
        amount: 2100,
      },
      {
        description: "Travel and expenses",
        quantity: 1,
        unitPrice: 1900,
        amount: 1900,
      },
    ],
  },
];

export function POGallery() {
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);

  const downloadPDF = (po: PO) => {
    const options: POPdfOptions = {
      vendorName: po.vendorName,
      vendorContact: po.vendorContact,
      vendorEmail: po.vendorEmail,
      vendorPhone: po.vendorPhone,
      campaignName: po.campaignName,
      wfNumber: po.campaignWF,
      poDate: po.poDate,
      poNumber: po.poNumber,
      items: po.items,
      totalAmount: po.totalAmount,
      terms: "Net 30",
      notes: "Please sign and return by the invoice due date.",
    };

    const pdf = generatePOPdf(options);
    pdf.save(`${po.poNumber}-${po.vendorName}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_POS.map((po) => (
          <div
            key={po.id}
            className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedPO(po)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-text-primary">{po.poNumber}</p>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm text-text-secondary">{po.vendorName}</p>
              </div>
            </div>

            <div className="mb-4 pb-4 border-b border-border">
              <p className="text-xs text-text-secondary mb-1">
                {po.campaignWF} · {po.campaignName}
              </p>
              <p className="text-lg font-semibold text-primary">
                ${po.totalAmount.toLocaleString()}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadPDF(po);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PO
            </button>
          </div>
        ))}
      </div>

      {selectedPO && (
        <div className="mt-6 p-4 bg-bg-secondary rounded-lg border border-border">
          <h3 className="font-semibold text-text-primary mb-3">{selectedPO.poNumber} Details</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              <span className="font-medium">Vendor:</span> {selectedPO.vendorName}
            </p>
            <p>
              <span className="font-medium">Contact:</span> {selectedPO.vendorContact}
            </p>
            <p>
              <span className="font-medium">Campaign:</span> {selectedPO.campaignWF} -{" "}
              {selectedPO.campaignName}
            </p>
            <p>
              <span className="font-medium">Total Amount:</span> ${selectedPO.totalAmount.toLocaleString()}
            </p>
            <p>
              <span className="font-medium">Items:</span> {selectedPO.items.length} line items
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
