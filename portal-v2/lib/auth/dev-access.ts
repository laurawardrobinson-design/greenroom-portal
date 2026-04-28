function isTrue(value: string | undefined): boolean {
  return value === "true";
}

// Dev-login is enabled when NEXT_PUBLIC_DEV_AUTH=true.
// Note: this app's Vercel deployment is a demo environment that intentionally
// uses dev-login as the primary login method. The env-var check is the gate;
// disabling NEXT_PUBLIC_DEV_AUTH on a real-production deployment is what
// turns dev-login off.
export function isDevAuthEnabled(): boolean {
  return isTrue(process.env.NEXT_PUBLIC_DEV_AUTH);
}

// Reset endpoint follows dev-auth: wherever dev-login is enabled (local dev
// and the demo Vercel deployment), reset is enabled too. The endpoint only
// touches the two demo accounts (admin@test.local, producer@test.local), so
// gating it behind dev-auth is sufficient — if dev-login is off, there are
// no demo accounts to reset anyway.
export function isResetEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return isDevAuthEnabled();
}

