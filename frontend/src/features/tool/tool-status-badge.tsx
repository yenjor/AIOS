import { Badge } from "@/components/ui/badge";

import type {
  McpServerStatus,
  ToolHealthStatus,
  ToolStatus,
  ToolVersionStatus,
} from "./model";

export function ToolStatusBadge({
  status,
}: {
  status: ToolStatus | ToolVersionStatus | McpServerStatus;
}) {
  const tone =
    status === "PUBLISHED" || status === "ENABLED"
      ? "success"
      : status === "SUSPENDED"
        ? "error"
        : status === "TESTING" || status === "DEPRECATED"
          ? "warning"
          : "neutral";

  return <Badge tone={tone}>{status}</Badge>;
}

export function ToolHealthBadge({ status }: { status: ToolHealthStatus }) {
  const tone =
    status === "HEALTHY"
      ? "success"
      : status === "DEGRADED"
        ? "warning"
        : status === "UNAVAILABLE"
          ? "error"
          : "neutral";

  return <Badge tone={tone}>{status}</Badge>;
}
