import type { Metadata } from "next";

import { McpCenterLoader } from "@/features/tool/mcp-center-loader";

export const metadata: Metadata = {
  title: "MCP 连接中心 | AIOS",
};

export default function McpCenterPage() {
  return <McpCenterLoader />;
}
