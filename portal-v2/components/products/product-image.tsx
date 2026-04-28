"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
  onClick?: () => void;
};

/**
 * Renders a product image with a basket-icon fallback when the URL is
 * missing or fails to load. Image URLs may originate from external
 * sources (publix CDN, etc.) before being mirrored into our Storage —
 * the fallback keeps the UI clean if a mirror is missing or broken.
 */
export function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  iconClassName,
  onClick,
}: Props) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className={
          fallbackClassName ??
          "flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0"
        }
      >
        <ShoppingBasket className={iconClassName ?? "h-6 w-6 text-text-tertiary"} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
