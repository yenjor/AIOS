import { Badge } from "@/components/ui/badge";

import type { AgentStatus, AgentVersionStatus } from "./model";

const tones = {
  DRAFT: "neutral",
  TESTING: "warning",
  ENABLED: "success",
  SUSPENDED: "warning",
  DISABLED: "error",
  PUBLISHED: "success",
  RETIRED: "neutral",
} as const;

export const AGENT_STATUS_LABELS: Record<
  AgentStatus | AgentVersionStatus,
  string
> = {
  DRAFT: "草稿",
  TESTING: "测试中",
  ENABLED: "已启用",
  SUSPENDED: "已暂停",
  DISABLED: "已禁用",
  PUBLISHED: "已发布",
  RETIRED: "已退役",
};

export function AgentStatusBadge({
  status,
}: {
  status: AgentStatus | AgentVersionStatus;
}) {
  return <Badge tone={tones[status]}>{AGENT_STATUS_LABELS[status]}</Badge>;
}
