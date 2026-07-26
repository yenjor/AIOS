import type { Metadata } from "next";

import { KnowledgeCenterLoader } from "@/features/knowledge/knowledge-center-loader";

export const metadata: Metadata = {
  title: "Knowledge Center | AIOS",
};

export default function KnowledgePage() {
  return <KnowledgeCenterLoader />;
}
