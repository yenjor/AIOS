import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TASK_STATUSES, TASK_STATUS_LABELS } from "./task-status";
import { TaskStatusBadge } from "./task-status-badge";

describe("TaskStatusBadge", () => {
  it.each(TASK_STATUSES)(
    "renders the canonical label and a non-color status cue for %s",
    (status) => {
      render(<TaskStatusBadge status={status} />);

      const badge = screen.getByText(TASK_STATUS_LABELS[status]);
      expect(badge).toBeVisible();
      expect(badge.closest("[data-task-status]")).toHaveAttribute(
        "data-task-status",
        status,
      );
      expect(badge.closest("[data-task-status]")?.querySelector("svg")).not.toBeNull();
    },
  );
});
