"use client";

import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { EstimatesGallery } from "./estimates-gallery";
import { POGallery } from "./po-gallery";
import { InvoiceGallery } from "./invoice-gallery";

interface DemoModeModalProps {
  onClose: () => void;
}

type TabType = "estimates" | "po" | "invoice";

export function DemoModeModal({ onClose }: DemoModeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("estimates");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Demo Mode</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-secondary rounded transition-colors"
            title="Close (ESC)"
          >
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {(["estimates", "po", "invoice"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab === "estimates" && "Estimates"}
              {tab === "po" && "Purchase Orders"}
              {tab === "invoice" && "Invoices"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "estimates" && <EstimatesGallery />}
          {activeTab === "po" && <POGallery />}
          {activeTab === "invoice" && <InvoiceGallery />}
        </div>
      </div>
    </div>
  );
}
