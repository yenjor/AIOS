import type { Metadata } from "next";

import { CapabilityDetailLoader } from "@/features/capability/capability-detail-loader";

export const metadata: Metadata = {
  title: "能力详情 | AIOS",
};

export default async function CapabilityDetailPage({
  params,
}: {
  params: Promise<{ capabilityId: string }>;
}) {
  const { capabilityId } = await params;
  return <CapabilityDetailLoader capabilityId={capabilityId} />;
}
