import type { Metadata } from "next";

import { TaskWizardLoader } from "@/features/task/task-wizard/task-wizard-loader";

export const metadata: Metadata = {
  title: "创建 Task | AIOS",
};

export default function NewTaskPage() {
  return <TaskWizardLoader />;
}
