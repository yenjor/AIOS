"use client";

import type { ReactNode } from "react";

import { SessionProvider } from "@/features/session/session-provider";

export interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
