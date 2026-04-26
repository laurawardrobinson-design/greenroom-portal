function isTrue(value: string | undefined): boolean {
  return value === "true";
}

// Dev-login is available whenever NEXT_PUBLIC_DEV_AUTH=true,
// but is hard-disabled in production regardless of env vars.
export function isDevAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
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

