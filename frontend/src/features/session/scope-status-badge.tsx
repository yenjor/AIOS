import {
  Archive,
  CheckCircle2,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AccessStatus } from "@/types/domain";

const accessStatusPresentation: Record<
  AccessStatus,
  { icon: LucideIcon; tone: "success" | "warning" | "neutral" }
> = {
  可访问: { icon: CheckCircle2, tone: "success" },
  无权限: { icon: LockKeyhole, tone: "warning" },
  已归档: { icon: Archive, tone: "neutral" },
};

export function ScopeStatusBadge({ status }: { status: AccessStatus }) {
  const { icon: Icon, tone } = accessStatusPresentation[status];

  return (
    <Badge tone={tone} className="gap-1.5">
      <Icon size={13} aria-hidden="true" />
      {status}
    </Badge>
  );
}
