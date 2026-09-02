import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  rating: number;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Five stars with a clipped overlay for the fractional part, so 4.6 reads as
 * four full stars and a partial fifth rather than rounding away the detail.
 */
export function StarRating({ rating, className, size = "sm" }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, rating));
  const starSize = size === "sm" ? "size-3.5" : "size-5";

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(starSize, "text-muted-foreground/30")} fill="currentColor" />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(starSize, "shrink-0 text-amber-500")} fill="currentColor" />
        ))}
      </span>
    </span>
  );
}
