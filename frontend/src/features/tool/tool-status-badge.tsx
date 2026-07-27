import { Badge } from "@/components/ui/badge";

import type {
  McpServerStatus,
  ToolHealthStatus,
  ToolStatus,
  ToolVersionStatus,
} from "./model";

const statusLabels: Record<
  ToolStatus | ToolVersionStatus | McpServerStatus,
  string
> = {
  DRAFT: "草稿",
  TESTING: "测试中",
  PUBLISHED: "已发布",
  DEPRECATED: "已弃用",
  RETIRED: "已退役",
  ENABLED: "已启用",
  SUSPENDED: "已暂停",
};

const healthLabels: Record<ToolHealthStatus, string> = {
  UNKNOWN: "未知",
  HEALTHY: "健康",
  DEGRADED: "性能下降",
  UNAVAILABLE: "不可用",
};

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

  return <Badge tone={tone}>{statusLabels[status]}</Badge>;
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

  return <Badge tone={tone}>{healthLabels[status]}</Badge>;
}
