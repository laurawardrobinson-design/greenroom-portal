function isTrue(value: string | undefined): boolean {
  return value === "true";
}

// Dev-login stays available in non-production when NEXT_PUBLIC_DEV_AUTH=true.
// In production-like environments, require an additional server-only opt-in.
export function isDevAuthEnabled(): boolean {
  if (!isTrue(process.env.NEXT_PUBLIC_DEV_AUTH)) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return isTrue(process.env.DEV_AUTH_ALLOW_PRODUCTION);
}

// Reset endpoint stays available in local development by default.
// Outside local dev, require explicit public toggle and production opt-in.
export function isResetEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (!isTrue(process.env.NEXT_PUBLIC_RESET_ENABLED)) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return isTrue(process.env.RESET_ALLOW_PRODUCTION);
}

