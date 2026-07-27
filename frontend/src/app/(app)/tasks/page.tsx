import type { Metadata } from "next";

import { TaskCenterLoader } from "@/features/task/task-center-loader";

export const metadata: Metadata = {
  title: "任务中心 | AIOS",
};

export default function TasksPage() {
  return <TaskCenterLoader />;
}
