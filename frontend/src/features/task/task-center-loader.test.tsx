import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskPage, TaskQuery } from "./model";
import { TaskRepositoryError } from "./mock/task-repository";
import { TaskCenterLoader } from "./task-center-loader";

const { getTaskPermission, listTasks, useSession } = vi.hoisted(() => ({
  getTaskPermission: vi.fn(),
  listTasks: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/features/session/session-provider", () => ({
  useSession,
}));

vi.mock("./mock/task-repository", () => ({
  getTaskPermission,
  listTasks,
  TaskRepositoryError: class TaskRepositoryError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
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

const emptyPage = (query: TaskQuery = {}): TaskPage => ({
  total: 0,
  page: query.page ?? 1,
  pageSize: query.pageSize ?? 8,
  items: [],
});

beforeEach(() => {
  getTaskPermission.mockReset();
  listTasks.mockReset();
  useSession.mockReset();
  getTaskPermission.mockResolvedValue({
    allowed: true,
    code: "ALLOWED",
    reason: "Allowed.",
  });
  listTasks.mockImplementation(
    (_scope: unknown, _actor: unknown, query: TaskQuery) =>
      Promise.resolve(emptyPage(query)),
  );
});

describe("TaskCenterLoader", () => {
  it("waits for hydration and complete scope before checking permission or data", async () => {
    useSession.mockReturnValue({ ...completeSession, hydrated: false });
    const view = render(<TaskCenterLoader />);

    await waitFor(() => expect(getTaskPermission).not.toHaveBeenCalled());
    expect(listTasks).not.toHaveBeenCalled();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("checks permission first, then loads the page and four repository summaries", async () => {
    useSession.mockReturnValue(completeSession);
    let permissionResolved = false;
    getTaskPermission.mockImplementation(async () => {
      permissionResolved = true;
      return { allowed: true, code: "ALLOWED", reason: "Allowed." };
    });
    listTasks.mockImplementation(
      (_scope: unknown, _actor: unknown, query: TaskQuery) => {
        expect(permissionResolved).toBe(true);
        const totals: Record<string, number> = {
          mine: 4,
          pendingApproval: 1,
          EXECUTING: 2,
          pendingReview: 3,
        };
        const key =
          query.ownership === "mine" ||
          query.ownership === "pendingApproval" ||
          query.ownership === "pendingReview"
            ? query.ownership
            : query.status ?? "page";
        return Promise.resolve({
          ...emptyPage(query),
          total: totals[String(key)] ?? 13,
        });
      },
    );

    render(<TaskCenterLoader />);

    expect(await screen.findByRole("heading", { name: "Task Center" })).toBeVisible();
    expect(getTaskPermission).toHaveBeenCalledWith(
      { organizationId: "org-guangwei", workspaceId: "ws-ai" },
      { userId: "user-pm" },
    );
    expect(listTasks).toHaveBeenCalledTimes(5);
    expect(screen.getByRole("group", { name: "我的任务" })).toHaveTextContent("4");
    expect(screen.getByRole("group", { name: "待我审批" })).toHaveTextContent("1");
    expect(screen.getByRole("group", { name: "执行中" })).toHaveTextContent("2");
    expect(screen.getByRole("group", { name: "待我验收" })).toHaveTextContent("3");
  });

  it("lets Auditor read the list without exposing Task creation", async () => {
    useSession.mockReturnValue({
      ...completeSession,
      user: { id: "user-auditor", name: "赵岚", role: "Auditor" },
    });
    getTaskPermission.mockResolvedValue({
      allowed: false,
      code: "FORBIDDEN",
      reason: "Read only.",
    });

    render(<TaskCenterLoader />);

    expect(await screen.findByRole("heading", { name: "Task Center" })).toBeVisible();
    expect(listTasks).toHaveBeenCalledTimes(5);
    expect(
      screen.queryByRole("link", { name: "创建 Task" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("当前身份可查看 Task，但不能创建。")).toBeVisible();
  });

  it("retains the active query when retrying a safe error", async () => {
    const interaction = userEvent.setup();
    useSession.mockReturnValue(completeSession);
    listTasks
      .mockImplementationOnce(
        (_scope: unknown, _actor: unknown, query: TaskQuery) =>
          Promise.resolve(emptyPage(query)),
      )
      .mockResolvedValueOnce(emptyPage({ ownership: "mine", pageSize: 1 }))
      .mockResolvedValueOnce(emptyPage({ ownership: "pendingApproval", pageSize: 1 }))
      .mockResolvedValueOnce(emptyPage({ status: "EXECUTING", pageSize: 1 }))
      .mockResolvedValueOnce(emptyPage({ ownership: "pendingReview", pageSize: 1 }));

    render(<TaskCenterLoader />);
    await screen.findByRole("heading", { name: "Task Center" });

    listTasks.mockRejectedValueOnce(new Error("private backend details"));
    await interaction.selectOptions(
      screen.getByRole("combobox", { name: "状态" }),
      "EXECUTING",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task 列表加载失败",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "private backend details",
    );

    listTasks.mockImplementation(
      (_scope: unknown, _actor: unknown, query: TaskQuery) =>
        Promise.resolve(emptyPage(query)),
    );
    await interaction.click(screen.getByRole("button", { name: "重试加载" }));
    await screen.findByRole("heading", { name: "Task Center" });

    expect(listTasks).toHaveBeenCalledWith(
      { organizationId: "org-guangwei", workspaceId: "ws-ai" },
      { userId: "user-pm" },
      expect.objectContaining({ status: "EXECUTING", page: 1, pageSize: 8 }),
    );
  });

  it("distinguishes an invalid local store without leaking repository details", async () => {
    useSession.mockReturnValue(completeSession);
    getTaskPermission.mockRejectedValue(
      new TaskRepositoryError(
        "INVALID_STORE",
        "private local envelope details",
      ),
    );

    render(<TaskCenterLoader />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("本地 Task 数据未通过完整性校验");
    expect(alert).not.toHaveTextContent("private local envelope details");
    expect(listTasks).not.toHaveBeenCalled();
  });

  it("ignores an old page after the active user changes", async () => {
    let resolveOld!: (page: TaskPage) => void;
    useSession.mockReturnValue(completeSession);
    listTasks
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockImplementation(
        (_scope: unknown, _actor: unknown, query: TaskQuery) =>
          Promise.resolve(emptyPage(query)),
      );

    const view = render(<TaskCenterLoader />);
    await waitFor(() => expect(listTasks).toHaveBeenCalledTimes(5));
    useSession.mockReturnValue({
      ...completeSession,
      user: { id: "user-dev", name: "周航", role: "开发工程师" },
    });
    view.rerender(<TaskCenterLoader />);

    await waitFor(() => expect(getTaskPermission).toHaveBeenCalledTimes(2));
    resolveOld({ ...emptyPage(), total: 99 });
    expect(await screen.findByRole("heading", { name: "Task Center" })).toBeVisible();
    expect(listTasks).toHaveBeenCalledWith(
      { organizationId: "org-guangwei", workspaceId: "ws-ai" },
      { userId: "user-dev" },
      expect.objectContaining({ page: 1, pageSize: 8 }),
    );
    await waitFor(() =>
      expect(screen.queryByText("共 99 个 Task")).not.toBeInTheDocument(),
    );
  });
});
