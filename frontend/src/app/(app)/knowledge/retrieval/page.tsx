import type { Metadata } from "next";

import { KnowledgeRetrievalScreen } from "@/features/knowledge/knowledge-retrieval-screen";

export const metadata: Metadata = {
  title: "Knowledge Retrieval | AIOS",
};

export default function KnowledgeRetrievalPage() {
  return <KnowledgeRetrievalScreen />;
}
