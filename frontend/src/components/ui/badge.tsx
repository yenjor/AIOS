import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--aios-canvas)] text-[var(--aios-muted)]",
        info: "bg-[color-mix(in_srgb,var(--aios-accent)_16%,var(--aios-surface))] text-[var(--aios-info-foreground)]",
        success: "bg-[color-mix(in_srgb,var(--aios-success)_16%,var(--aios-surface))] text-[var(--aios-success-foreground)]",
        warning: "bg-[color-mix(in_srgb,var(--aios-warning)_16%,var(--aios-surface))] text-[var(--aios-warning-foreground)]",
        error: "bg-[color-mix(in_srgb,var(--aios-error)_16%,var(--aios-surface))] text-[var(--aios-error-foreground)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends ComponentPropsWithRef<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
