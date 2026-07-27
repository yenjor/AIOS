import type { Metadata } from "next";

import { ToolCenterLoader } from "@/features/tool/tool-center-loader";

export const metadata: Metadata = {
  title: "工具中心 | AIOS",
};

export default function ToolsPage() {
  return <ToolCenterLoader />;
}
