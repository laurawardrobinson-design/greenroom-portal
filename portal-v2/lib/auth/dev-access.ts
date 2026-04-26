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

// Reset endpoint stays available in local development by default.
// Outside local dev, require explicit public toggle. In production, an
// additional server-only opt-in (RESET_ALLOW_PRODUCTION) is required.
export function isResetEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (!isTrue(process.env.NEXT_PUBLIC_RESET_ENABLED)) return false;
  if (process.env.NODE_ENV === "production") {
    return isTrue(process.env.RESET_ALLOW_PRODUCTION);
  }
  return true;
}

