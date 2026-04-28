"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PRDocContent } from "@/components/product-requests/pr-doc-drawer";

export default function PRDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Product Requests
      </button>

      <PRDocContent id={id} onClose={() => router.back()} />
    </div>
  );
}
