"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { PRDepartment } from "@/types/domain";

interface RBUToken {
  department: PRDepartment;
  publicToken: string;
}

const RBU_DEPT_ORDER: PRDepartment[] = [
  "Bakery",
  "Produce",
  "Deli",
  "Meat-Seafood",
  "Grocery",
];

export default function RBULandingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rbu/tokens");
      if (!res.ok) throw new Error(String(res.status));
      const data: RBUToken[] = await res.json();
      const order = new Map<PRDepartment, number>(
        RBU_DEPT_ORDER.map((d, i) => [d, i])
      );
      data.sort(
        (a, b) =>
          (order.get(a.department) ?? 99) - (order.get(b.department) ?? 99)
      );
      const first = data[0];
      if (!first) throw new Error("no tokens");
      window.location.href = `/pr/dept/${first.publicToken}`;
    } catch {
      setError("Failed to sign in. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4 pt-16 pb-12 sm:pt-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-8 max-w-[260px]">
            <Image
              src="/greenroom-logo.png"
              alt="Greenroom — Publix Creative Studio"
              width={260}
              height={76}
              priority
              className="w-full h-auto"
            />
          </div>
          <p className="text-sm font-medium tracking-wide text-white/60">
            The smarter way to run production.
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/10 p-6">
          <p className="mb-4 text-center text-xs text-white/50">
            Retail Business Unit
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/15 transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-semibold ring-1 ring-white/10">
                G
              </span>
              <div className="text-left">
                <div className="font-medium">Sign in as Grant</div>
                <div className="text-[11px] text-white/50">RBU reviewer</div>
              </div>
            </div>
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <ArrowRight className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
            )}
          </button>

          {error && (
            <p className="mt-3 text-center text-xs text-red-300">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-white/40">
          Read-only · maintained by Brand Marketing
        </p>
      </div>
    </div>
  );
}
