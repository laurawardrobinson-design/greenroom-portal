import { getProductIcon } from "@/components/onboarding/onboarding-modal";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface UserAvatarProps {
  name: string;
  favoriteProduct?: string;
  size?: AvatarSize;
  /** Use "dark" for the sidebar (white text on white/10 bg) */
  variant?: "light" | "dark";
}

const sizeConfig: Record<AvatarSize, { container: string; icon: string; text: string }> = {
  xs: { container: "h-5 w-5", icon: "h-4 w-4", text: "text-[10px]" },
  sm: { container: "h-7 w-7", icon: "h-5 w-5", text: "text-[11px]" },
  md: { container: "h-8 w-8", icon: "h-6 w-6", text: "text-xs" },
  lg: { container: "h-10 w-10", icon: "h-7 w-7", text: "text-sm" },
  xl: { container: "h-14 w-14", icon: "h-10 w-10", text: "text-lg" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({ name, favoriteProduct, size = "md", variant = "light" }: UserAvatarProps) {
  const iconSrc = favoriteProduct ? getProductIcon(favoriteProduct) : null;
  const config = sizeConfig[size];

  const bg = variant === "dark" ? "bg-emerald-400/20" : (iconSrc ? "bg-primary/5" : "bg-primary/10");
  const textColor = variant === "dark" ? "text-white" : "text-primary";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${bg} ${config.container}`}
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className={`${config.icon} object-contain`} />
      ) : (
        <span className={`font-semibold leading-none ${textColor} ${config.text}`}>
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
