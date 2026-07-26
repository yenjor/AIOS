import type { Metadata } from "next";

import { KnowledgeCenterLoader } from "@/features/knowledge/knowledge-center-loader";

export const metadata: Metadata = {
  title: "知识库 | AIOS",
};

export default function KnowledgePage() {
  return <KnowledgeCenterLoader />;
}
