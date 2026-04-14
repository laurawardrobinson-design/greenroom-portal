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
  { key: "postproducer", label: "Post Producer", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
];

interface Vendor {
  id: string;
  company_name: string;
  contact_name: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch demo vendors when vendor role is selected
  useEffect(() => {
    if (selectedRole === "vendor" && vendors.length === 0) {
      fetchDemoVendors();
    }
  }, [selectedRole, vendors.length]);

  async function fetchDemoVendors() {
    setVendorLoading(true);
    try {
      const res = await fetch("/api/demo/vendors");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch {
      console.error("Failed to fetch vendors");
    }
    setVendorLoading(false);
  }

  async function handleDevLogin(role: string, vendorId?: string) {
    setLoading(role);
    try {
      const body: any = { role };
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 max-w-[260px]">
            <img
              src="/greenroom-logo.png"
              alt="Greenroom — Publix Creative Studio"
              className="w-full"
            />
          </div>
          <p className="text-sm text-white/50">
            Sign in to manage campaigns, vendors, and gear
          </p>
        </div>

        {/* Sign in card */}
        <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/10 p-6">
          {/* SSO Placeholder (not yet wired up) */}
          <div className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-400 shadow-sm cursor-not-allowed select-none">
            Placeholder - Single Sign On
          </div>

          {/* Dev login */}
          {DEV_AUTH && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">
                  Dev Mode
                </span>
                <div className="h-px flex-1 bg-white/15" />
              </div>
              <p className="-mt-3 mb-4 text-center text-xs text-white/30">Click any role to sign in instantly</p>

              {/* Vendor selector (shown when vendor is selected) */}
              {selectedRole === "vendor" ? (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-white/70 mb-2">
                      Select Demo Vendor
                    </label>
                    {vendorLoading ? (
                      <div className="text-center py-4 text-sm text-white/50">Loading vendors...</div>
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
                        if (r.key === "vendor") {
                          setSelectedRole("vendor");
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

        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">April 14, 2026</p>
          <p className="text-sm font-medium text-white/50">New feature in progress! Post production workflow under construction.</p>
        </div>

        {!DEV_AUTH && (
          <p className="mt-6 text-center text-xs text-white/30">
            Access is restricted to authorized team members and vendors
          </p>
        )}
      </div>
      <p className="absolute bottom-4 text-sm text-white/40">
        Designed by Laura Robinson — contact with feature requests
      </p>
    </div>
  );
}
