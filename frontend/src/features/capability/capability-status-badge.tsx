import { Badge } from "@/components/ui/badge";

import type { CapabilityReleaseStatus } from "./model";

const labels: Record<CapabilityReleaseStatus, string> = {
  DRAFT: "Draft",
  VALIDATING: "Validating",
  IN_REVIEW: "In Review",
  PUBLISHED: "Published",
  SUSPENDED: "Suspended",
  DEPRECATED: "Deprecated",
  RETIRED: "Retired",
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
      {labels[status]}
    </Badge>
  );
}
