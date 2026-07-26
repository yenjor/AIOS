import { KnowledgeVersionCreateLoader } from "@/features/knowledge/knowledge-version-create-loader";

export interface NewKnowledgeVersionPageProps {
  params: Promise<{ knowledgeId: string }>;
}

export default async function NewKnowledgeVersionPage({
  params,
}: NewKnowledgeVersionPageProps) {
  const { knowledgeId } = await params;
  return <KnowledgeVersionCreateLoader knowledgeId={knowledgeId} />;
}
