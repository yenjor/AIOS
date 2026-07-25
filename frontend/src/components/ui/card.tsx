import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/cn";

export type CardProps = ComponentPropsWithRef<"div">;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[color-mix(in_srgb,var(--aios-muted)_25%,var(--aios-surface))] bg-[var(--aios-surface)] shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
