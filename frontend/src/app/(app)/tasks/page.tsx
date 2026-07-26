import type { Metadata } from "next";

import { TaskCenterLoader } from "@/features/task/task-center-loader";

export const metadata: Metadata = {
  title: "Task Center | AIOS",
};

export default function TasksPage() {
  return <TaskCenterLoader />;
}
