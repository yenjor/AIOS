import type { Metadata } from "next";

import { KnowledgeCreateLoader } from "@/features/knowledge/knowledge-create-loader";

export const metadata: Metadata = {
  title: "新增 Knowledge | AIOS",
};

export default function NewKnowledgePage() {
  return <KnowledgeCreateLoader />;
}
