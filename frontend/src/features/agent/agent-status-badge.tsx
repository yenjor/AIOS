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

export function AgentStatusBadge({
  status,
}: {
  status: AgentStatus | AgentVersionStatus;
}) {
  return <Badge tone={tones[status]}>{status}</Badge>;
}
