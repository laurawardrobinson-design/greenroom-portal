"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";

const DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === "true";

const DEV_ROLES = [
  { key: "admin", label: "HOP (Admin)", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "producer", label: "Producer", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "studio", label: "Studio", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "vendor", label: "Vendor", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
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
  const [resetUserId, setResetUserId] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

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

  async function handleGoogleLogin() {
    setLoading("google");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
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

      await mutate("/api/auth/me", undefined, { revalidate: false });
      router.push("/dashboard");
      router.refresh();
    } catch {
      alert("Login failed");
      setLoading(null);
    }
  }

  async function handleResetPreferences() {
    if (!resetUserId.trim()) {
      setResetMessage({ type: "error", text: "Please enter a user ID or email" });
      return;
    }

    setResetLoading(true);
    setResetMessage(null);

    try {
      const res = await fetch("/api/auth/reset-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUserId }),
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
        text: "Preferences reset! User will see onboarding on next login.",
      });
      setResetUserId("");
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
    <div className="flex min-h-dvh items-center justify-center bg-sidebar px-4">
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
          {/* SSO Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === "google" && (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
            )}
            {loading === "google" ? "Signing in..." : "Placeholder - Single Sign On"}
          </button>

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
                <>
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

                  {/* Reset Preferences Section */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <label className="block text-xs font-medium text-white/70 mb-2">
                      Reset User Preferences
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="User ID or email"
                        value={resetUserId}
                        onChange={(e) => setResetUserId(e.target.value)}
                        disabled={resetLoading}
                        className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40 disabled:opacity-50"
                      />
                      <button
                        onClick={handleResetPreferences}
                        disabled={resetLoading}
                        className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-all disabled:opacity-50"
                      >
                        {resetLoading ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          "Reset"
                        )}
                      </button>
                    </div>
                    {resetMessage && (
                      <p
                        className={`mt-2 text-xs ${
                          resetMessage.type === "success"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {resetMessage.text}
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          {DEV_AUTH
            ? "Development mode — click any role to sign in instantly"
            : "Access is restricted to authorized team members and vendors"}
        </p>
      </div>
    </div>
  );
}
