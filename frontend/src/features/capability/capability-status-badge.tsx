import { Badge } from "@/components/ui/badge";

import type { CapabilityReleaseStatus } from "./model";

export const CAPABILITY_STATUS_LABELS: Record<CapabilityReleaseStatus, string> = {
  DRAFT: "草稿",
  VALIDATING: "验证中",
  IN_REVIEW: "审核中",
  PUBLISHED: "已发布",
  SUSPENDED: "已暂停",
  DEPRECATED: "已弃用",
  RETIRED: "已退役",
};

export function CapabilityStatusBadge({
  status,
}: {
  status: CapabilityReleaseStatus;
}) {
  return (
    <Badge
      tone={
        status === "PUBLISHED"
          ? "success"
          : status === "SUSPENDED" || status === "RETIRED"
            ? "error"
            : status === "DRAFT" || status === "IN_REVIEW"
              ? "warning"
              : "neutral"
      }
    >
      {CAPABILITY_STATUS_LABELS[status]}
    </Badge>
  );
}
