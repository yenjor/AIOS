import type { Metadata } from "next";

import { McpCreateLoader } from "@/features/tool/mcp-create-loader";

export const metadata: Metadata = {
  title: "注册 MCP 服务 | AIOS",
};

export default function McpCreatePage() {
  return <McpCreateLoader />;
}
