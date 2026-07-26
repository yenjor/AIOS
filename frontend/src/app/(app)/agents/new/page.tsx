import type { Metadata } from "next";

import { AgentCreateLoader } from "@/features/agent/agent-create-loader";

export const metadata: Metadata = {
  title: "创建 AI 员工 | AIOS",
};

export default function CreateAgentPage() {
  return <AgentCreateLoader />;
}
