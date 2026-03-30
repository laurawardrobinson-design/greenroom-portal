"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";

const DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === "true";

const DEV_ROLES = [
  { key: "admin", label: "HOP (Admin)", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "producer", label: "Producer", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "studio", label: "Studio", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
  { key: "vendor", label: "Vendor", color: "bg-white/10 text-white border-white/20 hover:bg-white/15" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

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

  async function handleDevLogin(role: string) {
    setLoading(role);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
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
          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === "google" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {loading === "google" ? "Signing in..." : "Sign in with Google"}
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

              <div className="grid grid-cols-2 gap-2">
                {DEV_ROLES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => handleDevLogin(r.key)}
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
