"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function UnlockPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/site-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        setError("Incorrect password.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4 pt-16 pb-12 sm:pt-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-8 max-w-[260px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/greenroom-logo.png"
              alt="Greenroom — Publix Creative Studio"
              className="w-full"
            />
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur-sm"
        >
          <p className="text-center text-xs leading-relaxed text-white/55">
            Password required to prevent automated traffic.
          </p>

          <div className="relative mt-4">
            <input
              id="site-password"
              type={showPassword ? "text" : "password"}
              autoFocus
              aria-label="Site password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 pr-11 text-sm text-white outline-none focus:border-white/40 autofill-dark"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-white/60 hover:text-white/90"
            >
              {showPassword ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="mt-4 h-9 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white transition-all hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Unlocking…" : "Unlock"}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
          Questions? Contact Laura Robinson.
        </p>
      </div>
    </div>
  );
}
