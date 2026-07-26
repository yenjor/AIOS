import type { Metadata } from "next";

import { CapabilityCreateLoader } from "@/features/capability/capability-create-loader";

export const metadata: Metadata = {
  title: "创建能力 | AIOS",
};

export default function CreateCapabilityPage() {
  return <CapabilityCreateLoader />;
}
