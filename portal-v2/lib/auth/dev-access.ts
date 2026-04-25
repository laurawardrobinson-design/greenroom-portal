function isTrue(value: string | undefined): boolean {
  return value === "true";
}

// Dev-login is available whenever NEXT_PUBLIC_DEV_AUTH=true.
export function isDevAuthEnabled(): boolean {
  return isTrue(process.env.NEXT_PUBLIC_DEV_AUTH);
}

// Reset endpoint stays available in local development by default.
// Outside local dev, require explicit public toggle and production opt-in.
export function isResetEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (!isTrue(process.env.NEXT_PUBLIC_RESET_ENABLED)) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return isTrue(process.env.RESET_ALLOW_PRODUCTION);
}

