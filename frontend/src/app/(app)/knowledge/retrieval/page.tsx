import type { Metadata } from "next";

import { KnowledgeRetrievalScreen } from "@/features/knowledge/knowledge-retrieval-screen";

export const metadata: Metadata = {
  title: "知识库检索 | AIOS",
};

export default function KnowledgeRetrievalPage() {
  return <KnowledgeRetrievalScreen />;
}
