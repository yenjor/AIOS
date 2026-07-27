import type { Metadata } from "next";

import { McpDetailLoader } from "@/features/tool/mcp-detail-loader";

export const metadata: Metadata = {
  title: "MCP Server 详情 | AIOS",
};

export default async function McpDetailPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;
  return <McpDetailLoader serverId={serverId} />;
}
