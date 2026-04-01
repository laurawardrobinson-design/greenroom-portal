"use client";

import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { generateEstimatePdf, EstimatePdfOptions } from "@/lib/utils/pdf-generator";

interface Estimate {
  id: string;
  campaign_vendors: {
    campaign_id: string;
    campaign: {
      wf_number: string;
      name: string;
    };
    vendor: {
      company_name: string;
      contact_name: string;
      email: string;
      phone: string;
    };
    estimate_total: number;
    status: string;
  };
  vendor_estimate_items: Array<{
    category: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
}

const STATUS_COLORS: { [key: string]: string } = {
  "Estimate Submitted": "bg-blue-100 text-blue-800",
  "Estimate Approved": "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

export function EstimatesGallery() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for demo - in production this would fetch from an API
    const mockEstimates: Estimate[] = [
      {
        id: "cv000000-0000-0000-0000-000000000001",
        campaign_vendors: {
          campaign_id: "c0000000-0000-0000-0000-000000000001",
          campaign: { wf_number: "WF210501", name: "Organic Produce Campaign" },
          vendor: {
            company_name: "Lightbox Studios Inc.",
            contact_name: "Marcus Thompson",
            email: "marcus@lightboxstudios.demo",
            phone: "(212) 555-0101",
          },
          estimate_total: 8500,
          status: "Estimate Approved",
        },
        vendor_estimate_items: [
          {
            category: "Studio Space",
            description: "Studio rental - 2 full days",
            quantity: 2,
            unit_price: 2500,
            amount: 5000,
          },
          {
            category: "Equipment Rental",
            description: "Lighting kit and grip package",
            quantity: 1,
            unit_price: 2000,
            amount: 2000,
          },
          {
            category: "Styling",
            description: "Gaffer and grip crew (2 people)",
            quantity: 2,
            unit_price: 750,
            amount: 1500,
          },
        ],
      },
      {
        id: "cv000000-0000-0000-0000-000000000003",
        campaign_vendors: {
          campaign_id: "c0000000-0000-0000-0000-000000000001",
          campaign: { wf_number: "WF210501", name: "Organic Produce Campaign" },
          vendor: {
            company_name: "Culinary Artistry Co.",
            contact_name: "Elizabeth Ross",
            email: "elizabeth@culinaryartistry.demo",
            phone: "(212) 555-0103",
          },
          estimate_total: 4500,
          status: "Estimate Submitted",
        },
        vendor_estimate_items: [
          {
            category: "Styling",
            description: "Food styling - 2 days",
            quantity: 2,
            unit_price: 1500,
            amount: 3000,
          },
          {
            category: "Catering",
            description: "Food and beverage materials",
            quantity: 1,
            unit_price: 1200,
            amount: 1200,
          },
          {
            category: "Travel",
            description: "Travel and meals for stylist",
            quantity: 1,
            unit_price: 300,
            amount: 300,
          },
        ],
      },
    ];

    setEstimates(mockEstimates);
    setLoading(false);
  }, []);

  const downloadPDF = (estimate: Estimate) => {
    const { campaign_vendors, vendor_estimate_items } = estimate;
    const options: EstimatePdfOptions = {
      vendorName: campaign_vendors.vendor.company_name,
      vendorContact: campaign_vendors.vendor.contact_name,
      vendorEmail: campaign_vendors.vendor.email,
      vendorPhone: campaign_vendors.vendor.phone,
      campaignName: campaign_vendors.campaign.name,
      wfNumber: campaign_vendors.campaign.wf_number,
      estimateDate: new Date().toISOString(),
      items: vendor_estimate_items.map((item) => ({
        category: item.category,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        amount: item.amount,
      })),
      totalAmount: campaign_vendors.estimate_total,
    };

    const pdf = generateEstimatePdf(options);
    pdf.save(
      `estimate-${campaign_vendors.campaign.wf_number}-${campaign_vendors.vendor.company_name}.pdf`
    );
  };

  if (loading) {
    return <div className="text-center text-text-secondary">Loading estimates...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {estimates.map((estimate) => (
        <div
          key={estimate.id}
          className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-text-primary">
                {estimate.campaign_vendors.vendor.company_name}
              </h3>
              <p className="text-sm text-text-secondary">
                {estimate.campaign_vendors.campaign.wf_number}{" "}
                {estimate.campaign_vendors.campaign.name}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                STATUS_COLORS[estimate.campaign_vendors.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {estimate.campaign_vendors.status}
            </span>
          </div>

          <div className="mb-4 pb-4 border-b border-border">
            <p className="text-lg font-semibold text-primary">
              ${estimate.campaign_vendors.estimate_total.toLocaleString()}
            </p>
            <p className="text-sm text-text-secondary">
              {estimate.vendor_estimate_items.length} line items
            </p>
          </div>

          <button
            onClick={() => downloadPDF(estimate)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      ))}
    </div>
  );
}
