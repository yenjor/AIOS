import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { workspaceDashboard } from "@/mock/fixtures";
import type { WorkspaceDashboard } from "@/types/domain";

import { WorkspaceDashboardLoader } from "./workspace-dashboard-loader";

const { getWorkspaceDashboard, useSession } = vi.hoisted(() => ({
  getWorkspaceDashboard: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/features/session/session-provider", () => ({
  useSession,
}));

vi.mock("@/mock/repository", () => ({
  getWorkspaceDashboard,
}));

const completeSession = {
  hydrated: true,
  user: { id: "user-lead", name: "陈明", role: "研发负责人" },
  organization: { id: "org-guangwei", name: "光位科技" },
  workspace: {
    id: "ws-from-active-session",
    organizationId: "org-guangwei",
    name: "会话工作空间",
    purpose: "验证真实范围",
  },
};

beforeEach(() => {
  getWorkspaceDashboard.mockReset();
  useSession.mockReset();
});

describe("WorkspaceDashboardLoader", () => {
  it("queries only after hydration and a complete session, using the active 工作空间标识", async () => {
    let resolveDashboard!: (value: typeof workspaceDashboard) => void;
    getWorkspaceDashboard.mockReturnValue(
      new Promise((resolve) => {
        resolveDashboard = resolve;
      }),
    );
    useSession.mockReturnValue({ ...completeSession, hydrated: false });

    const view = render(<WorkspaceDashboardLoader />);

    expect(getWorkspaceDashboard).not.toHaveBeenCalled();

    useSession.mockReturnValue(completeSession);
    view.rerender(<WorkspaceDashboardLoader />);

    expect(await screen.findByRole("status")).toHaveTextContent("正在加载工作空间");
    expect(getWorkspaceDashboard).toHaveBeenCalledTimes(1);
    expect(getWorkspaceDashboard).toHaveBeenCalledWith("ws-from-active-session");

    resolveDashboard(workspaceDashboard);
    expect(
      await screen.findByRole("heading", { name: "工作空间工作台" }),
    ).toBeVisible();
  });

  it.each([
    ["未恢复", { ...completeSession, hydrated: false }],
    ["缺少用户", { ...completeSession, user: undefined }],
    ["缺少组织", { ...completeSession, organization: undefined }],
    ["缺少工作空间", { ...completeSession, workspace: undefined }],
  ])("%s时不查询受保护快照", async (_label, session) => {
    useSession.mockReturnValue(session);

    const view = render(<WorkspaceDashboardLoader />);

    await waitFor(() => expect(getWorkspaceDashboard).not.toHaveBeenCalled());
    expect(view.container).toBeEmptyDOMElement();
  });

  it("announces an error and retries the same active 工作空间", async () => {
    const interaction = userEvent.setup();
    useSession.mockReturnValue(completeSession);
    getWorkspaceDashboard
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(workspaceDashboard);

    render(<WorkspaceDashboardLoader />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("工作空间数据加载失败");
    await interaction.click(screen.getByRole("button", { name: "重试加载" }));

    expect(getWorkspaceDashboard).toHaveBeenCalledTimes(2);
    expect(getWorkspaceDashboard).toHaveBeenLastCalledWith("ws-from-active-session");
    expect(
      await screen.findByRole("heading", { name: "工作空间工作台" }),
    ).toBeVisible();
  });

  it("ignores an older response after the active 工作空间 changes", async () => {
    let resolveOld!: (value: typeof workspaceDashboard) => void;
    const newerSnapshot = structuredClone(
      workspaceDashboard,
    ) as WorkspaceDashboard;
    newerSnapshot.workspace.id = "ws-new";
    newerSnapshot.workspace.name = "新范围";
    newerSnapshot.metrics.todo = 99;
    getWorkspaceDashboard
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(newerSnapshot);
    useSession.mockReturnValue({
      ...completeSession,
      workspace: { ...completeSession.workspace, id: "ws-old" },
    });

    const view = render(<WorkspaceDashboardLoader />);
    useSession.mockReturnValue({
      ...completeSession,
      workspace: { ...completeSession.workspace, id: "ws-new" },
    });
    view.rerender(<WorkspaceDashboardLoader />);

    await waitFor(() => expect(getWorkspaceDashboard).toHaveBeenCalledTimes(2));
    resolveOld(workspaceDashboard);
    const todoMetric = await screen.findByRole("group", { name: "我的待办" });
    expect(todoMetric).toHaveTextContent("99");
    expect(getWorkspaceDashboard).toHaveBeenNthCalledWith(1, "ws-old");
    expect(getWorkspaceDashboard).toHaveBeenNthCalledWith(2, "ws-new");
  });
});
