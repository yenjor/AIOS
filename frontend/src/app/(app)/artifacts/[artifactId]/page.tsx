import { ArtifactDetailLoader } from "@/features/artifact/artifact-detail-loader";

export interface ArtifactDetailPageProps {
  params: Promise<{ artifactId: string }>;
}

export default async function ArtifactDetailPage({
  params,
}: ArtifactDetailPageProps) {
  const { artifactId } = await params;
  return <ArtifactDetailLoader artifactId={artifactId} />;
}
