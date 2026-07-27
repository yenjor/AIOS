import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCreateLink } from "./task-create-permission";

const { getTaskPermission, useSession } = vi.hoisted(() => ({
  getTaskPermission: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/features/session/session-provider", () => ({
  useSession,
}));

vi.mock("./mock/task-repository", () => ({
  getTaskPermission,
}));

const completeSession = {
  hydrated: true,
  user: { id: "user-pm", name: "林悦", role: "产品经理" },
  organization: { id: "org-guangwei", name: "光位科技" },
  workspace: {
    id: "ws-ai",
    organizationId: "org-guangwei",
    name: "AI 智能业务线",
  },
};

beforeEach(() => {
  getTaskPermission.mockReset();
  useSession.mockReset();
});

describe("TaskCreateLink", () => {
  it("does not expose an enabled action before hydration and scope recovery", () => {
    useSession.mockReturnValue({ ...completeSession, hydrated: false });

    render(<TaskCreateLink>创建任务</TaskCreateLink>);

    expect(getTaskPermission).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "创建任务" })).not.toBeInTheDocument();
  });

  it("renders the real creation route only after the repository allows it", async () => {
    useSession.mockReturnValue(completeSession);
    getTaskPermission.mockResolvedValue({
      allowed: true,
      code: "ALLOWED",
      reason: "任务 creation is allowed.",
    });

    render(<TaskCreateLink>创建任务</TaskCreateLink>);

    const link = await screen.findByRole("link", { name: "创建任务" });
    expect(link).toHaveAttribute("href", "/tasks/new");
    expect(getTaskPermission).toHaveBeenCalledWith(
      { organizationId: "org-guangwei", workspaceId: "ws-ai" },
      { userId: "user-pm" },
    );
  });

  it("keeps 审计员 creation absent without hard-coding the role in the UI", async () => {
    useSession.mockReturnValue({
      ...completeSession,
      user: { id: "user-auditor", name: "赵岚", role: "审计员" },
    });
    getTaskPermission.mockResolvedValue({
      allowed: false,
      code: "FORBIDDEN",
      reason: "任务 creation is not allowed.",
    });

    render(<TaskCreateLink>创建任务</TaskCreateLink>);

    await waitFor(() => expect(getTaskPermission).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link", { name: "创建任务" })).not.toBeInTheDocument();
  });

  it("ignores a stale permission response after the active actor changes", async () => {
    let resolveOld!: (value: {
      allowed: boolean;
      code: "ALLOWED";
      reason: string;
    }) => void;
    getTaskPermission
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce({
        allowed: false,
        code: "FORBIDDEN",
        reason: "Read only.",
      });
    useSession.mockReturnValue(completeSession);

    const view = render(<TaskCreateLink>创建任务</TaskCreateLink>);
    useSession.mockReturnValue({
      ...completeSession,
      user: { id: "user-auditor", name: "赵岚", role: "审计员" },
    });
    view.rerender(<TaskCreateLink>创建任务</TaskCreateLink>);

    await waitFor(() => expect(getTaskPermission).toHaveBeenCalledTimes(2));
    resolveOld({
      allowed: true,
      code: "ALLOWED",
      reason: "Old actor was allowed.",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "创建任务" }),
      ).not.toBeInTheDocument(),
    );
  });
});
