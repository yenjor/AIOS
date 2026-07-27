import type { Metadata } from "next";

import { ToolDetailLoader } from "@/features/tool/tool-detail-loader";

export const metadata: Metadata = {
  title: "工具详情 | AIOS",
};

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ toolId: string }>;
}) {
  const { toolId } = await params;
  return <ToolDetailLoader toolId={toolId} />;
}
