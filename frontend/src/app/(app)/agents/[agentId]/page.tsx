import type { Metadata } from "next";

import { AgentDetailLoader } from "@/features/agent/agent-detail-loader";

export const metadata: Metadata = {
  title: "AI 员工详情 | AIOS",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <AgentDetailLoader agentId={agentId} />;
}
