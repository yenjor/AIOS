import { Badge } from "@/components/ui/badge";

import type {
  KnowledgeEffectiveStatus,
  KnowledgeIndexStatus,
} from "./model";

const effectiveLabels: Record<KnowledgeEffectiveStatus, string> = {
  DRAFT: "草稿",
  EFFECTIVE: "有效",
  INVALIDATED: "已失效",
};

const indexLabels: Record<KnowledgeIndexStatus, string> = {
  PENDING: "等待索引",
  INDEXING: "索引中",
  READY: "索引就绪",
  FAILED: "索引失败",
  STALE: "索引过期",
};

export function KnowledgeEffectiveBadge({
  status,
}: {
  status: KnowledgeEffectiveStatus;
}) {
  return (
    <Badge
      data-knowledge-effective-status={status}
      tone={
        status === "EFFECTIVE"
          ? "success"
          : status === "INVALIDATED"
            ? "error"
            : "warning"
      }
    >
      {effectiveLabels[status]}
    </Badge>
  );
}

export function KnowledgeIndexBadge({
  status,
}: {
  status: KnowledgeIndexStatus;
}) {
  return (
    <Badge
      data-knowledge-index-status={status}
      tone={
        status === "READY"
          ? "success"
          : status === "FAILED"
            ? "error"
            : status === "STALE"
              ? "warning"
              : "info"
      }
    >
      {indexLabels[status]}
    </Badge>
  );
}
