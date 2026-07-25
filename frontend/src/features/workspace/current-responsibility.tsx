"use client";

import { useSession } from "@/features/session/session-provider";

export function CurrentResponsibility() {
  const { user } = useSession();

  if (!user) {
    return null;
  }

  return (
    <p className="mt-2 text-sm text-[var(--aios-muted)]">
      当前职责：{user.role}
    </p>
  );
}
