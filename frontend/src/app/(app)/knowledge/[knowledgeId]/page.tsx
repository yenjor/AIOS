import { KnowledgeDetailLoader } from "@/features/knowledge/knowledge-detail-loader";

export interface KnowledgeDetailPageProps {
  params: Promise<{ knowledgeId: string }>;
}

export default async function KnowledgeDetailPage({
  params,
}: KnowledgeDetailPageProps) {
  const { knowledgeId } = await params;
  return <KnowledgeDetailLoader knowledgeId={knowledgeId} />;
}
