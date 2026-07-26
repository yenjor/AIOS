import { TaskDetailLoader } from "@/features/task/task-detail-loader";

export interface TaskDetailPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({
  params,
}: TaskDetailPageProps) {
  const { taskId } = await params;

  return <TaskDetailLoader taskId={taskId} />;
}
