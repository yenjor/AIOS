import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--aios-primary)] text-[var(--aios-surface)] hover:bg-[color-mix(in_srgb,var(--aios-primary)_85%,var(--aios-navigation))] focus-visible:outline-[var(--aios-primary)]",
        secondary:
          "border border-[color-mix(in_srgb,var(--aios-muted)_35%,var(--aios-surface))] bg-[var(--aios-surface)] text-[var(--aios-text)] hover:bg-[var(--aios-canvas)] focus-visible:outline-[var(--aios-primary)]",
        danger:
          "bg-[var(--aios-error)] text-[var(--aios-surface)] hover:bg-[color-mix(in_srgb,var(--aios-error)_85%,var(--aios-navigation))] focus-visible:outline-[var(--aios-error)]",
        ghost:
          "text-[var(--aios-text)] hover:bg-[var(--aios-canvas)] focus-visible:outline-[var(--aios-primary)]",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface ButtonProps
  extends ComponentPropsWithRef<"button">,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, type = "button", ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} type={type} {...props} />;
}
