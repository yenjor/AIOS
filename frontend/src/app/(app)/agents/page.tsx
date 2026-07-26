import type { Metadata } from "next";

import { AgentCenterLoader } from "@/features/agent/agent-center-loader";

export const metadata: Metadata = {
  title: "AI 员工中心 | AIOS",
};

export default function AgentsPage() {
  return <AgentCenterLoader />;
}
