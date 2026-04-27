"use client";

import { useState, useEffect } from "react";

const DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === "true";
const RESET_ENABLED = process.env.NEXT_PUBLIC_RESET_ENABLED === "true" || process.env.NODE_ENV === "development";

const DEV_ROLES = [
  { key: "admin", label: "HOP (Admin)", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "producer", label: "Producer", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "studio", label: "Studio", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "vendor", label: "Vendor", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "artdirector", label: "Art Director", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "creativedirector", label: "Creative/Design Director", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "postproducer", label: "Post Producer", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "designer", label: "Designer", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "bmm", label: "Brand Marketing Mgr", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "rbu", label: "RBU", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
];

const LOGIN_NOTIFICATIONS = [
  // Add new login page updates here. Viewers cannot edit these.
  {
    date: "April 27, 2026",
    text: "Major upgrades! Brand Marketing and RBU roles are now live, with better visibility into product inventory and requests. We've also completed a design overhaul and SOC 2 cybersecurity readiness audit.",
  },
  {
    date: "April 20, 2026",
    text: "New feature — Asset Studio. Designers can version mechanicals with automation.",
  },
  {
    date: "April 14, 2026",
    text: "Post production workflow under construction.",
  },
];

interface Vendor {
  id: string;
  company_name: string;
  contact_name: string;
}

interface RBUToken {
  department: string;
  publicToken: string;
}

const RBU_DEPT_ORDER = [
  "Bakery",
  "Produce",
  "Deli",
  "Meat-Seafood",
  "Grocery",
] as const;

const RBU_DEPT_LABELS: Record<string, string> = {
  Bakery: "Bakery",
  Produce: "Produce",
  Deli: "Deli",
  "Meat-Seafood": "Meat & Seafood",
  Grocery: "Grocery",
};

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rbuTokens, setRbuTokens] = useState<RBUToken[]>([]);
  const [rbuLoading, setRbuLoading] = useState(false);
  const [rbuError, setRbuError] = useState<string | null>(null);

  // Fetch demo vendors when vendor role is selected
  useEffect(() => {
    if (selectedRole === "vendor" && vendors.length === 0) {
      fetchDemoVendors();
    }
  }, [selectedRole, vendors.length]);

  // Fetch RBU dept tokens when RBU role is selected
  useEffect(() => {
    if (selectedRole === "rbu" && rbuTokens.length === 0) {
      fetchRbuTokens();
    }
  }, [selectedRole, rbuTokens.length]);

  async function fetchRbuTokens() {
    setRbuLoading(true);
    setRbuError(null);
    try {
      const res = await fetch("/api/rbu/tokens");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RBUToken[] = await res.json();
      const order = new Map<string, number>(
        RBU_DEPT_ORDER.map((d, i) => [d, i])
      );
      data.sort(
        (a, b) =>
          (order.get(a.department) ?? 99) - (order.get(b.department) ?? 99)
      );
      setRbuTokens(data);
    } catch {
      setRbuError("Failed to load departments. Try again.");
    }
    setRbuLoading(false);
  }

  async function fetchDemoVendors() {
    setVendorLoading(true);
    setVendorError(null);
    try {
      const res = await fetch("/api/demo/vendors");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVendors(data.vendors || []);
    } catch {
      setVendorError("Failed to load vendors. Check your connection and try again.");
    }
    setVendorLoading(false);
  }

  async function handleDevLogin(role: string, vendorId?: string) {
    setLoading(role);
    try {
      const body: { role: string; vendor_id?: string } = { role };
      if (vendorId) body.vendor_id = vendorId;

      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Login failed");
        setLoading(null);
        return;
      }

      // Full page load so the browser picks up the new auth cookies
      window.location.href = "/dashboard";
    } catch {
      alert("Login failed");
      setLoading(null);
    }
  }

  async function handleResetPreferences() {
    setResetLoading(true);
    setResetMessage(null);

    try {
      const res = await fetch("/api/auth/reset-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetMessage({
          type: "error",
          text: data.error || "Failed to reset preferences",
        });
        return;
      }

      setResetMessage({
        type: "success",
        text: "HOP & Producer reset! They will see onboarding on next login.",
      });
    } catch {
      setResetMessage({
        type: "error",
        text: "Failed to reset preferences",
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4 pt-16 pb-12 sm:pt-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-8 max-w-[260px]">
            <img
              src="/greenroom-logo.png"
              alt="Greenroom — Publix Creative Studio"
              className="w-full"
            />
          </div>
          <p className="text-sm font-medium tracking-wide text-white/60">
            The smarter way to run production.
          </p>
        </div>

        {/* Sign in card */}
        <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/10 p-6">
          {/* Dev login */}
          {DEV_AUTH && (
            <>
              <p className="mb-4 text-center text-xs text-white/50">Click any role to sign in instantly</p>

              {/* RBU selector (shown when RBU is selected) */}
              {selectedRole === "rbu" ? (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-white/70 mb-2">
                      Select Department
                    </label>
                    {rbuLoading ? (
                      <div className="text-center py-4 text-sm text-white/50">Loading departments...</div>
                    ) : rbuError ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-sm text-red-300">{rbuError}</p>
                        <button
                          onClick={fetchRbuTokens}
                          className="text-xs text-white/70 underline hover:text-white"
                        >
                          Retry
                        </button>
                      </div>
                    ) : rbuTokens.length === 0 ? (
                      <div className="text-center py-4 text-sm text-white/50">No departments found</div>
                    ) : (
                      <div className="space-y-2">
                        {rbuTokens.map((t) => (
                          <a
                            key={t.department}
                            href={`/pr/dept/${t.publicToken}`}
                            className="block w-full text-left rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-xs text-white hover:bg-white/10 transition-all"
                          >
                            <span className="font-medium">
                              {RBU_DEPT_LABELS[t.department] ?? t.department}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRole(null)}
                    className="w-full mt-2 text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    ← Back to roles
                  </button>
                </>
              ) : /* Vendor selector (shown when vendor is selected) */
              selectedRole === "vendor" ? (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-white/70 mb-2">
                      Select Demo Vendor
                    </label>
                    {vendorLoading ? (
                      <div className="text-center py-4 text-sm text-white/50">Loading vendors...</div>
                    ) : vendorError ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-sm text-red-300">{vendorError}</p>
                        <button
                          onClick={fetchDemoVendors}
                          className="text-xs text-white/70 underline hover:text-white"
                        >
                          Retry
                        </button>
                      </div>
                    ) : vendors.length === 0 ? (
                      <div className="text-center py-4 text-sm text-white/50">No demo vendors found</div>
                    ) : (
                      <div className="space-y-2">
                        {vendors.map((vendor) => (
                          <button
                            key={vendor.id}
                            onClick={() => handleDevLogin("vendor", vendor.id)}
                            disabled={loading !== null}
                            className="w-full text-left rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-xs hover:bg-white/10 transition-all disabled:opacity-50"
                          >
                            {loading === "vendor" ? (
                              <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                              <>
                                <div className="font-medium text-white">{vendor.company_name}</div>
                                <div className="text-white/50 text-[10px]">{vendor.contact_name}</div>
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRole(null)}
                    disabled={loading !== null}
                    className="w-full mt-2 text-xs text-white/50 hover:text-white/70 transition-colors"
                  >
                    ← Back to roles
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {DEV_ROLES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => {
                        if (r.key === "vendor" || r.key === "rbu") {
                          setSelectedRole(r.key);
                        } else {
                          handleDevLogin(r.key);
                        }
                      }}
                      disabled={loading !== null}
                      className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all disabled:opacity-50 ${r.color}`}
                    >
                      {loading === r.key ? (
                        <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        r.label
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Reset test users — available via NEXT_PUBLIC_RESET_ENABLED or in local dev */}
          {RESET_ENABLED && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                onClick={handleResetPreferences}
                disabled={resetLoading}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {resetLoading ? (
                  <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  "Reset Users"
                )}
              </button>
              {resetMessage && (
                <p
                  className={`mt-2 text-xs text-center ${
                    resetMessage.type === "success"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {resetMessage.text}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 max-h-32 overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-white/5 px-4 py-3 pr-3">
          <div className="space-y-4">
            {LOGIN_NOTIFICATIONS.map((notification) => (
              <article key={`${notification.date}-${notification.text}`}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#69A925]">
                  {notification.date}
                </p>
                <p className="text-sm font-medium leading-5 text-white/50">
                  {notification.text}
                </p>
              </article>
            ))}
          </div>
        </div>

        {!DEV_AUTH && (
          <p className="mt-6 text-center text-xs text-white/30">
            Access is restricted to authorized team members and vendors
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="h-px w-16 bg-white/20" />
        <p className="whitespace-nowrap text-xs font-medium tracking-wide text-white/90">
          Experience by{" "}
          <span
            onClick={() => window.location.href = "/laurai"}
            style={{ color: "#00B4D8" }}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >LaurAI</span>
        </p>
      </div>
    </div>
  );
}
