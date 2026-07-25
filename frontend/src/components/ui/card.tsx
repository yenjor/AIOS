import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className, ...props }: CardProps) {
  return <section className={cn("rounded-[10px] border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}
