import type { Metadata } from "next";

import { CapabilityCenterLoader } from "@/features/capability/capability-center-loader";

export const metadata: Metadata = {
  title: "能力中心 | AIOS",
};

export default function CapabilitiesPage() {
  return <CapabilityCenterLoader />;
}
