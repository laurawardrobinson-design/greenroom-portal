"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function UnlockPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
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
          <p className="text-center text-xs text-white/60">
            Enter the site password to continue.
          </p>

          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-4 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
          />

          {error && (
            <p className="mt-3 text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="mt-4 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
