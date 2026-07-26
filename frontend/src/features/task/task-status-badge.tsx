import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  CirclePause,
  CircleX,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/types/domain";

import {
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "./task-status";

type TaskStatusTone = BadgeTone | "neutral";

interface TaskStatusPresentation {
  icon: LucideIcon;
  tone: TaskStatusTone;
}

const TASK_STATUS_PRESENTATION = {
  DRAFT: { icon: CircleDot, tone: "neutral" },
  READY: { icon: CheckCircle2, tone: "info" },
  PLANNING: { icon: LoaderCircle, tone: "info" },
  NEED_INPUT: { icon: CircleAlert, tone: "warning" },
  NEED_APPROVAL: { icon: Clock3, tone: "warning" },
  EXECUTING: { icon: LoaderCircle, tone: "info" },
  PAUSED: { icon: CirclePause, tone: "warning" },
  FAILED: { icon: CircleX, tone: "error" },
  REVIEW: { icon: ClipboardCheck, tone: "warning" },
  REWORK: { icon: RotateCcw, tone: "warning" },
  COMPLETED: { icon: CheckCircle2, tone: "success" },
  CANCELLED: { icon: Ban, tone: "neutral" },
} as const satisfies Record<TaskStatus, TaskStatusPresentation>;

export interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const { icon: Icon, tone } = TASK_STATUS_PRESENTATION[status];

  return (
    <Badge
      tone={tone}
      className="gap-1.5"
      data-task-status={status}
      aria-label={`Task 状态：${TASK_STATUS_LABELS[status]}`}
    >
      <Icon size={13} aria-hidden="true" />
      <span>{TASK_STATUS_LABELS[status]}</span>
    </Badge>
  );
}
