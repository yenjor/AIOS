import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TaskRepositoryError,
  type TaskRepository,
} from "./mock/task-repository";
import type { TaskDetail } from "./model";
import { TaskDetailLoader } from "./task-detail-loader";

const { getTask, listTaskToolInvocations, useSession } = vi.hoisted(() => ({
  getTask: vi.fn<TaskRepository["getTask"]>(),
  listTaskToolInvocations: vi.fn().mockResolvedValue([]),
  useSession: vi.fn(),
}));

vi.mock("@/features/session/session-provider", () => ({
  useSession,
}));

vi.mock("./mock/task-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mock/task-repository")>();
  return { ...actual, getTask };
});

vi.mock("@/features/tool/mock/tool-repository", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tool/mock/tool-repository")
    >();
  return { ...actual, listTaskToolInvocations };
});

const completeSession = {
  hydrated: true,
  user: { id: "user-auditor", name: "赵岚", role: "审计员" },
  organization: {
    id: "org-guangwei",
    name: "光位科技",
    purpose: "",
    accessibleWorkspaceCount: 1,
    lastEnteredAt: "",
    accessStatus: "可访问",
  },
  workspace: {
    id: "ws-ai",
    organizationId: "org-guangwei",
    name: "AI 智能业务线",
    purpose: "",
    lastEnteredAt: "",
    accessStatus: "可访问",
  },
};

function minimumDetail(): TaskDetail {
  return {
    id: "task-visible",
    scope: { organizationId: "org-guangwei", workspaceId: "ws-ai" },
    title: "生成任务中心技术方案",
    goalSummary: "形成可评审方案",
    templateName: "生成技术方案",
    expectedArtifactType: "技术方案",
    status: "NEED_APPROVAL",
    priority: 50,
    riskLevel: "R1",
    initiator: { userId: "user-pm" },
    assignedAgentName: "AI 研发员工",
    participantUserIds: ["user-pm", "user-lead"],
    approverUserIds: ["user-lead"],
    reviewerUserIds: ["user-lead"],
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-26T07:50:00.000Z",
    goal: "形成可实施的任务中心技术方案",
    constraints: ["遵循现有架构"],
    outOfScope: ["不执行写操作"],
    completionCriteria: ["技术方案完成人工验收"],
    capabilityVersionRefs: [],
    knowledgeVersionRefs: [],
    toolVersionRefs: [],
    approvalPoints: [],
    expectedArtifact: {
      artifactType: "技术方案",
      state: "EXPECTED",
      sections: ["目标理解"],
      knowledgeCitationRequired: true,
    },
    artifactVersionRefs: [],
    citationRefs: [],
    history: [
      {
        id: "history-1",
        fromStatus: null,
        toStatus: "DRAFT",
        reasonCode: "TASK_CREATED",
        actor: { actorType: "USER", actorId: "user-pm" },
        occurredAt: "2026-07-25T08:00:00.000Z",
        aggregateVersion: 1,
      },
    ],
    aggregateVersion: 1,
  };
}

beforeEach(() => {
  getTask.mockReset();
  listTaskToolInvocations.mockReset();
  listTaskToolInvocations.mockResolvedValue([]);
  useSession.mockReset();
});

describe("TaskDetailLoader", () => {
  it.each([
    ["会话尚未恢复", { ...completeSession, hydrated: false }],
    ["缺少用户", { ...completeSession, user: undefined }],
    ["缺少组织", { ...completeSession, organization: undefined }],
    ["缺少工作空间", { ...completeSession, workspace: undefined }],
  ])("%s时不访问任务仓储", async (_label, session) => {
    useSession.mockReturnValue(session);

    const view = render(<TaskDetailLoader taskId="task-visible" />);

    await waitFor(() => expect(getTask).not.toHaveBeenCalled());
    expect(view.container).toBeEmptyDOMElement();
  });

  it("uses only the hydrated active scope and stable actor identity", async () => {
    getTask.mockResolvedValue(minimumDetail());
    useSession.mockReturnValue(completeSession);

    render(<TaskDetailLoader taskId="task-visible" />);

    expect(await screen.findByRole("status")).toHaveTextContent("正在加载任务");
    expect(getTask).toHaveBeenCalledWith(
      { organizationId: "org-guangwei", workspaceId: "ws-ai" },
      { userId: "user-auditor" },
      "task-visible",
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "生成任务中心技术方案",
      }),
    ).toBeVisible();
    expect(screen.getByText("赵岚（审计员）")).toBeVisible();
    expect(
      screen.getByText("当前身份仅可查看此任务的执行证据。"),
    ).toBeVisible();
  });

  it.each(["FORBIDDEN", "NOT_FOUND"] as const)(
    "uses the same non-disclosing state for %s",
    async (code) => {
      useSession.mockReturnValue(completeSession);
      getTask.mockRejectedValue(
        new TaskRepositoryError(code, `${code}: private detail`),
      );

      render(<TaskDetailLoader taskId="task-private" />);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("任务不可用");
      expect(alert).toHaveTextContent("无法在当前工作范围中安全显示该任务");
      expect(alert).not.toHaveTextContent(code);
      expect(alert).not.toHaveTextContent("private detail");
    },
  );

  it("announces repository errors and retries in the same scope", async () => {
    const interaction = userEvent.setup();
    useSession.mockReturnValue(completeSession);
    getTask
      .mockRejectedValueOnce(
        new TaskRepositoryError("INVALID_STORE", "unsafe storage detail"),
      )
      .mockResolvedValueOnce(minimumDetail());

    render(<TaskDetailLoader taskId="task-visible" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("任务数据加载失败");
    expect(alert).toHaveTextContent("本地只读数据无法通过完整性校验");
    expect(alert).not.toHaveTextContent("unsafe storage detail");

    await interaction.click(screen.getByRole("button", { name: "重试加载" }));

    expect(getTask).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "生成任务中心技术方案",
      }),
    ).toBeVisible();
  });

  it("does not reveal a stale 任务 after the active scope changes", async () => {
    let resolveOld!: (task: TaskDetail) => void;
    getTask
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockRejectedValueOnce(new TaskRepositoryError("NOT_FOUND", "missing"));
    useSession.mockReturnValue(completeSession);

    const view = render(<TaskDetailLoader taskId="task-visible" />);

    useSession.mockReturnValue({
      ...completeSession,
      workspace: { ...completeSession.workspace, id: "ws-other" },
    });
    view.rerender(<TaskDetailLoader taskId="task-visible" />);
    resolveOld(minimumDetail());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("任务不可用");
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: "生成任务中心技术方案",
      }),
    ).not.toBeInTheDocument();
  });
});
