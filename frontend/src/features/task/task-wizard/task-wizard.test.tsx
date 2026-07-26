import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskRepository } from "../mock/task-repository";
import type { TaskDraft } from "../model";
import { TaskWizard } from "./task-wizard";

const repository = vi.hoisted(() => ({
  saveDraft: vi.fn<TaskRepository["saveDraft"]>(),
  discardDraft: vi.fn<TaskRepository["discardDraft"]>(),
  submitTechnicalSolutionTask:
    vi.fn<TaskRepository["submitTechnicalSolutionTask"]>(),
}));
const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../mock/task-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../mock/task-repository")>()),
  ...repository,
}));

const scope = { organizationId: "org-guangwei", workspaceId: "ws-ai" };
const actor = { userId: "user-pm" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderWizard(initialDraft?: TaskDraft) {
  return render(
    <TaskWizard
      actor={actor}
      initialDraft={initialDraft}
      scope={scope}
      scopeLabels={{
        organizationName: "光位科技",
        workspaceName: "AI 智能业务线",
      }}
    />,
  );
}

function renderStrictWizard(initialDraft?: TaskDraft) {
  return render(
    <StrictMode>
      <TaskWizard
        actor={actor}
        initialDraft={initialDraft}
        scope={scope}
        scopeLabels={{
          organizationName: "光位科技",
          workspaceName: "AI 智能业务线",
        }}
      />
    </StrictMode>,
  );
}

async function goToDefinition(interaction: ReturnType<typeof userEvent.setup>) {
  await interaction.click(
    screen.getByRole("radio", { name: /生成技术方案/ }),
  );
  await interaction.click(screen.getByRole("button", { name: "下一步" }));
}

async function fillDefinition(interaction: ReturnType<typeof userEvent.setup>) {
  await interaction.type(screen.getByLabelText("Task 标题"), "生成技术方案");
  await interaction.type(screen.getByLabelText("Goal"), "形成可评审方案");
  await interaction.type(
    screen.getByLabelText("当前问题"),
    "缺少统一执行定义",
  );
  await interaction.type(screen.getByLabelText("任务范围"), "Task Center");
  fireEvent.change(screen.getByLabelText("期望完成时间"), {
    target: { value: "2026-08-01T18:00" },
  });
  await interaction.type(screen.getByLabelText("约束"), "遵循现有架构");
  await interaction.type(screen.getByLabelText("不做事项"), "不改后端");
}

beforeEach(() => {
  Object.values(repository).forEach((mock) => mock.mockReset());
  push.mockReset();
  repository.saveDraft.mockImplementation(
    async (_scope, _actor, draft) => draft,
  );
  window.confirm = vi.fn(() => true);
});

describe("TaskWizard", () => {
  it("restores the exact saved step and independent definition fields", () => {
    renderWizard({
      wizardStep: 2,
      templateName: "生成技术方案",
      title: "恢复中的方案",
      goal: "恢复 Goal",
      currentProblem: "恢复当前问题",
      workScope: "恢复任务范围",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["恢复约束"],
      outOfScope: ["恢复不做事项"],
      priority: 25,
      riskLevel: "R1",
    });

    expect(
      screen.getByRole("button", { name: "第 2 步：定义工作" }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText("Task 标题")).toHaveValue("恢复中的方案");
    expect(screen.getByLabelText("当前问题")).toHaveValue("恢复当前问题");
    expect(screen.getByLabelText("任务范围")).toHaveValue("恢复任务范围");
    expect(screen.getByLabelText("Priority")).toHaveValue(25);
    expect(screen.getByLabelText("期望完成时间")).not.toHaveValue("");
  });

  it("clamps an incomplete forged step-five draft and keeps future steps locked", () => {
    renderWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      priority: 50,
      riskLevel: "R1",
    });

    expect(
      screen.getByRole("heading", { name: "定义工作" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "第 2 步：定义工作" }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: "第 3 步：提供上下文" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "提交 Task" }),
    ).not.toBeInTheDocument();
  });

  it("announces field errors and focuses the first invalid field", async () => {
    const interaction = userEvent.setup();
    renderWizard();
    await goToDefinition(interaction);

    await interaction.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请修正");
    expect(screen.getByLabelText("Task 标题")).toHaveFocus();
    expect(screen.getByLabelText("Task 标题")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("error"),
    );
  });

  it("uses keyboard-operable step controls without unlocking unreached steps", async () => {
    const interaction = userEvent.setup();
    renderWizard();
    const stepOne = screen.getByRole("button", {
      name: "第 1 步：选择模板",
    });
    const stepTwo = screen.getByRole("button", {
      name: "第 2 步：定义工作",
    });
    const stepThree = screen.getByRole("button", {
      name: "第 3 步：提供上下文",
    });

    expect(stepTwo).toBeDisabled();
    expect(stepThree).toBeDisabled();
    await interaction.click(
      screen.getByRole("radio", { name: /生成技术方案/ }),
    );
    expect(stepTwo).toBeDisabled();
    await interaction.click(screen.getByRole("button", { name: "下一步" }));

    expect(stepTwo).toBeEnabled();
    expect(stepThree).toBeDisabled();
    stepOne.focus();
    await interaction.keyboard("{Enter}");
    await waitFor(() =>
      expect(stepOne).toHaveAttribute("aria-current", "step"),
    );
    stepTwo.focus();
    await interaction.keyboard(" ");
    await waitFor(() =>
      expect(stepTwo).toHaveAttribute("aria-current", "step"),
    );
  });

  it("keeps values when navigating back and saves through the repository", async () => {
    const interaction = userEvent.setup();
    renderWizard();
    await goToDefinition(interaction);
    await fillDefinition(interaction);
    await interaction.click(screen.getByRole("button", { name: "下一步" }));
    await interaction.click(screen.getByRole("button", { name: "上一步" }));

    expect(screen.getByLabelText("Task 标题")).toHaveValue("生成技术方案");
    expect(repository.saveDraft).toHaveBeenCalledWith(
      scope,
      actor,
      expect.objectContaining({
        title: "生成技术方案",
        priority: 50,
        wizardStep: 3,
        currentProblem: "缺少统一执行定义",
        workScope: "Task Center",
        expectedCompletionAt: expect.stringMatching(
          /^2026-08-01T\d{2}:00:00\.000Z$/,
        ),
      }),
    );
  });

  it("freezes edits while saving and persists the captured snapshot", async () => {
    const interaction = userEvent.setup();
    const pendingSave = deferred<TaskDraft>();
    repository.saveDraft.mockReturnValueOnce(pendingSave.promise);
    renderWizard({
      wizardStep: 2,
      templateName: "生成技术方案",
      title: "保存前标题",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循架构"],
      outOfScope: ["不改后端"],
      priority: 50,
      riskLevel: "R1",
    });

    await interaction.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledTimes(1));

    const title = screen.getByLabelText("Task 标题");
    expect(title).toBeDisabled();
    expect(screen.getByLabelText("Risk")).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一步" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "第 1 步：选择模板" }),
    ).toBeDisabled();
    fireEvent.change(title, { target: { value: "竞态标题" } });
    expect(title).toHaveValue("保存前标题");

    const savedSnapshot = repository.saveDraft.mock.calls[0][2];
    pendingSave.resolve(savedSnapshot);
    expect(await screen.findByRole("status")).toHaveTextContent("草稿已保存");
    expect(savedSnapshot.title).toBe("保存前标题");
  });

  it("recovers from StrictMode effect replay after a deferred save", async () => {
    const interaction = userEvent.setup();
    const pendingSave = deferred<TaskDraft>();
    repository.saveDraft.mockReturnValueOnce(pendingSave.promise);
    renderStrictWizard({
      wizardStep: 2,
      templateName: "生成技术方案",
      title: "严格模式标题",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循架构"],
      outOfScope: ["不改后端"],
      priority: 50,
      riskLevel: "R1",
    });

    await interaction.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledTimes(1));
    const savedSnapshot = repository.saveDraft.mock.calls[0][2];
    pendingSave.resolve(savedSnapshot);

    expect(await screen.findByRole("status")).toHaveTextContent("草稿已保存");
    expect(screen.getByLabelText("Task 标题")).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一步" })).toBeEnabled();

    await interaction.click(screen.getByRole("button", { name: "下一步" }));
    expect(
      await screen.findByRole("heading", { name: "提供上下文" }),
    ).toBeVisible();
  });

  it("freezes navigation during submit and routes only after the captured task resolves", async () => {
    const interaction = userEvent.setup();
    const pendingSubmit = deferred<
      Awaited<ReturnType<TaskRepository["submitTechnicalSolutionTask"]>>
    >();
    repository.submitTechnicalSolutionTask.mockReturnValue(
      pendingSubmit.promise,
    );
    renderWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      title: "提交快照",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循架构"],
      outOfScope: ["不改后端"],
      priority: 50,
      riskLevel: "R1",
      knowledgeVersionRefs: [
        {
          kind: "KNOWLEDGE",
          objectId: "knowledge-aios-docs",
          versionId: "knowledge-aios-docs-v1",
          versionNumber: 1,
          digest: "sha256:knowledge-aios-docs-v1",
        },
      ],
      completionCriteria: ["结构完整"],
    });

    await interaction.click(screen.getByRole("button", { name: "提交 Task" }));
    await waitFor(() =>
      expect(repository.submitTechnicalSolutionTask).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByRole("button", { name: "提交 Task" })).toBeDisabled();
    const stepTwo = screen.getByRole("button", {
      name: "第 2 步：定义工作",
    });
    expect(stepTwo).toBeDisabled();
    fireEvent.click(stepTwo);
    expect(
      screen.getByRole("button", { name: "第 5 步：确认执行" }),
    ).toHaveAttribute("aria-current", "step");
    expect(push).not.toHaveBeenCalled();

    pendingSubmit.resolve({
      id: "task-mock-0099",
    } as Awaited<
      ReturnType<TaskRepository["submitTechnicalSolutionTask"]>
    >);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/tasks/task-mock-0099"),
    );
  });

  it("ignores a late submit result after a real unmount", async () => {
    const interaction = userEvent.setup();
    const pendingSubmit = deferred<
      Awaited<ReturnType<TaskRepository["submitTechnicalSolutionTask"]>>
    >();
    repository.submitTechnicalSolutionTask.mockReturnValue(
      pendingSubmit.promise,
    );
    const view = renderStrictWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      title: "卸载前提交",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循架构"],
      outOfScope: ["不改后端"],
      priority: 50,
      riskLevel: "R1",
      knowledgeVersionRefs: [
        {
          kind: "KNOWLEDGE",
          objectId: "knowledge-aios-docs",
          versionId: "knowledge-aios-docs-v1",
          versionNumber: 1,
          digest: "sha256:knowledge-aios-docs-v1",
        },
      ],
      completionCriteria: ["结构完整"],
    });

    await interaction.click(screen.getByRole("button", { name: "提交 Task" }));
    await waitFor(() =>
      expect(repository.submitTechnicalSolutionTask).toHaveBeenCalledTimes(1),
    );
    view.unmount();

    await act(async () => {
      pendingSubmit.resolve({
        id: "task-mock-late",
      } as Awaited<
        ReturnType<TaskRepository["submitTechnicalSolutionTask"]>
      >);
      await pendingSubmit.promise;
    });

    expect(push).not.toHaveBeenCalled();
  });

  it("replaces a cleared field and restores it as empty after refresh", async () => {
    const interaction = userEvent.setup();
    let savedSnapshot: TaskDraft | undefined;
    repository.saveDraft.mockImplementation(async (_scope, _actor, draft) => {
      savedSnapshot = structuredClone(draft);
      return structuredClone(draft);
    });
    const view = renderWizard({
      wizardStep: 2,
      templateName: "生成技术方案",
      title: "需要清空",
      priority: 50,
      riskLevel: "R1",
    });

    fireEvent.change(screen.getByLabelText("Task 标题"), {
      target: { value: "" },
    });
    await interaction.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByRole("status");
    expect(savedSnapshot).not.toHaveProperty("title");

    view.unmount();
    renderWizard(savedSnapshot);
    expect(screen.getByLabelText("Task 标题")).toHaveValue("");
  });

  it("replaces golden-only refs when switching to a draft-only template", async () => {
    const interaction = userEvent.setup();
    let savedSnapshot: TaskDraft | undefined;
    repository.saveDraft.mockImplementation(async (_scope, _actor, draft) => {
      savedSnapshot = structuredClone(draft);
      return structuredClone(draft);
    });
    const view = renderWizard({
      wizardStep: 1,
      templateName: "生成技术方案",
      priority: 50,
      riskLevel: "R1",
      capabilityVersionRefs: [
        {
          kind: "CAPABILITY",
          objectId: "capability-technical-solution",
          versionId: "capability-technical-solution-v1",
          versionNumber: 1,
          digest: "sha256:capability-technical-solution-v1",
        },
      ],
      toolVersionRefs: [
        {
          kind: "TOOL",
          objectId: "tool-codegraph-read",
          versionId: "tool-codegraph-read-v1",
          versionNumber: 1,
          digest: "sha256:tool-codegraph-read-v1",
          actionId: "codegraph.context",
          operationType: "READ",
        },
      ],
    });

    await interaction.click(screen.getByRole("radio", { name: /分析需求/ }));
    await interaction.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByRole("status");
    expect(savedSnapshot).toMatchObject({ templateName: "分析需求" });
    expect(savedSnapshot).not.toHaveProperty("capabilityVersionRefs");
    expect(savedSnapshot).not.toHaveProperty("toolVersionRefs");
    expect(savedSnapshot).not.toHaveProperty("assignedAgent");

    view.unmount();
    renderWizard(savedSnapshot);
    expect(screen.getByRole("radio", { name: /分析需求/ })).toBeChecked();
  });

  it("discards only after native confirmation and restores the initial wizard", async () => {
    const interaction = userEvent.setup();
    renderWizard({ templateName: "分析需求" });

    await interaction.click(screen.getByRole("button", { name: "丢弃草稿" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(repository.discardDraft).toHaveBeenCalledWith(scope, actor);
    expect(screen.getByRole("radio", { name: /分析需求/ })).not.toBeChecked();
  });

  it("does not discard when native confirmation is cancelled", async () => {
    const interaction = userEvent.setup();
    window.confirm = vi.fn(() => false);
    renderWizard({ wizardStep: 1, templateName: "分析需求" });

    await interaction.click(screen.getByRole("button", { name: "丢弃草稿" }));

    expect(repository.discardDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /分析需求/ })).toBeChecked();
  });

  it("keeps non-golden templates draft-only with a visible reason", async () => {
    renderWizard({
      wizardStep: 5,
      templateName: "分析需求",
      title: "分析需求",
      goal: "明确需求",
      currentProblem: "边界不清",
      workScope: "需求分析",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["当前问题：边界不清", "任务范围：需求"],
      outOfScope: ["不编码"],
      priority: 50,
      riskLevel: "R1",
      knowledgeVersionRefs: [],
      completionCriteria: ["范围明确"],
      expectedArtifact: {
        artifactType: "需求分析报告",
        state: "EXPECTED",
        sections: ["目标与范围"],
        knowledgeCitationRequired: true,
      },
    });

    expect(screen.getByRole("button", { name: "提交 Task" })).toBeDisabled();
    expect(screen.getByText(/当前版本仅支持保存草稿/)).toBeVisible();
  });

  it.each(["R2", "R3"] as const)(
    "blocks a restored %s draft and focuses the R0/R1 risk control",
    async (riskLevel) => {
      const interaction = userEvent.setup();
      renderWizard({
        wizardStep: 5,
        templateName: "生成技术方案",
        title: "高风险旧草稿",
        goal: "形成方案",
        currentProblem: "缺少方案",
        workScope: "Task Center",
        expectedCompletionAt: "2026-08-01T10:00:00.000Z",
        constraints: ["遵循架构"],
        outOfScope: ["不改后端"],
        priority: 50,
        riskLevel,
        knowledgeVersionRefs: [
          {
            kind: "KNOWLEDGE",
            objectId: "knowledge-aios-docs",
            versionId: "knowledge-aios-docs-v1",
            versionNumber: 1,
            digest: "sha256:knowledge-aios-docs-v1",
          },
        ],
        completionCriteria: ["结构完整"],
      });

      expect(
        screen.getByRole("heading", { name: "定义工作" }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "第 3 步：提供上下文" }),
      ).toBeDisabled();
      await interaction.click(screen.getByRole("button", { name: "下一步" }));

      expect(screen.getByRole("alert")).toHaveTextContent("R0 或 R1");
      expect(screen.getByLabelText("Risk")).toHaveFocus();
      expect(screen.getByRole("option", { name: "R0" })).toBeVisible();
      expect(screen.getByRole("option", { name: "R1" })).toBeVisible();
      expect(screen.queryByRole("option", { name: riskLevel })).not.toBeInTheDocument();
      expect(repository.saveDraft).not.toHaveBeenCalled();
      expect(repository.submitTechnicalSolutionTask).not.toHaveBeenCalled();
    },
  );

  it("shows the required read-only checks on the Artifact step", () => {
    renderWizard({
      wizardStep: 4,
      templateName: "生成技术方案",
      title: "技术方案",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循架构"],
      outOfScope: ["不改后端"],
      riskLevel: "R1",
      priority: 50,
      knowledgeVersionRefs: [
        {
          kind: "KNOWLEDGE",
          objectId: "knowledge-aios-docs",
          versionId: "knowledge-aios-docs-v1",
          versionNumber: 1,
          digest: "sha256:knowledge-aios-docs-v1",
        },
      ],
    });

    expect(
      screen.getByRole("heading", { name: "必须通过的检查" }),
    ).toBeVisible();
    expect(screen.getByText("Artifact 结构完整性")).toBeVisible();
    expect(screen.getByText("Knowledge Citation 可追溯")).toBeVisible();
    expect(screen.getByText("Reviewer 人工验收")).toBeVisible();
  });

  it("submits a complete golden draft once and routes to its detail", async () => {
    const interaction = userEvent.setup();
    repository.submitTechnicalSolutionTask.mockResolvedValue({
      id: "task-mock-0001",
    } as Awaited<ReturnType<TaskRepository["submitTechnicalSolutionTask"]>>);
    renderWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      title: "生成技术方案",
      goal: "形成可评审方案",
      currentProblem: "缺少统一定义",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循现有架构"],
      outOfScope: ["不改后端"],
      priority: 50,
      riskLevel: "R1",
      capabilityVersionRefs: [
        {
          kind: "CAPABILITY",
          objectId: "capability-technical-solution",
          versionId: "capability-technical-solution-v1",
          versionNumber: 1,
          digest: "sha256:capability-technical-solution-v1",
        },
      ],
      knowledgeVersionRefs: [
        {
          kind: "KNOWLEDGE",
          objectId: "knowledge-aios-docs",
          versionId: "knowledge-aios-docs-v1",
          versionNumber: 1,
          digest: "sha256:knowledge-aios-docs-v1",
        },
      ],
      toolVersionRefs: [
        {
          kind: "TOOL",
          objectId: "tool-codegraph-read",
          versionId: "tool-codegraph-read-v1",
          versionNumber: 1,
          digest: "sha256:tool-codegraph-read-v1",
          actionId: "codegraph.context",
          operationType: "READ",
        },
      ],
      assignedAgent: {
        agentId: "agent-rd-001",
        agentName: "AI研发员工",
        agentVersionRef: {
          kind: "AGENT",
          objectId: "agent-rd-001",
          versionId: "agent-rd-001-v1",
          versionNumber: 1,
          digest: "sha256:agent-rd-001-v1",
        },
        autonomyLevel: "L1辅助",
        humanOwner: { userId: "user-lead", displayName: "陈明" },
      },
      expectedArtifact: {
        artifactType: "技术方案",
        state: "EXPECTED",
        sections: [
          "目标理解",
          "范围与不做事项",
          "影响模块与文件",
          "技术决策",
          "风险",
          "测试建议",
          "回退考虑",
          "Knowledge Citation",
        ],
        knowledgeCitationRequired: true,
      },
      completionCriteria: ["结构完整"],
    });

    expect(screen.getByText("codegraph.context")).toBeVisible();
    expect(screen.getByText("READ")).toBeVisible();
    expect(screen.getByText("计划确认")).toBeVisible();
    expect(screen.getByText("Artifact验收")).toBeVisible();

    const submit = screen.getByRole("button", { name: "提交 Task" });
    await Promise.all([interaction.click(submit), interaction.click(submit)]);

    await waitFor(() =>
      expect(repository.submitTechnicalSolutionTask).toHaveBeenCalledTimes(1),
    );
    expect(repository.saveDraft).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/tasks/task-mock-0001");
  });

  it("clamps a forged final step and focuses the first invalid field on continue", async () => {
    const interaction = userEvent.setup();
    renderWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      riskLevel: "R1",
      priority: 50,
    });

    expect(
      screen.queryByRole("button", { name: "提交 Task" }),
    ).not.toBeInTheDocument();

    await interaction.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请修正");
    expect(screen.getByLabelText("Task 标题")).toHaveFocus();
    expect(repository.submitTechnicalSolutionTask).not.toHaveBeenCalled();
  });

  it("retains the complete draft and retries a failed submit", async () => {
    const interaction = userEvent.setup();
    repository.submitTechnicalSolutionTask
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({
        id: "task-mock-0002",
      } as Awaited<
        ReturnType<TaskRepository["submitTechnicalSolutionTask"]>
      >);
    renderWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      title: "可重试方案",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "Task Center",
      expectedCompletionAt: "2026-08-01T10:00:00.000Z",
      constraints: ["遵循架构"],
      outOfScope: ["不改后端"],
      priority: 50,
      riskLevel: "R1",
      capabilityVersionRefs: [
        {
          kind: "CAPABILITY",
          objectId: "capability-technical-solution",
          versionId: "capability-technical-solution-v1",
          versionNumber: 1,
          digest: "sha256:capability-technical-solution-v1",
        },
      ],
      knowledgeVersionRefs: [
        {
          kind: "KNOWLEDGE",
          objectId: "knowledge-aios-docs",
          versionId: "knowledge-aios-docs-v1",
          versionNumber: 1,
          digest: "sha256:knowledge-aios-docs-v1",
        },
      ],
      toolVersionRefs: [
        {
          kind: "TOOL",
          objectId: "tool-codegraph-read",
          versionId: "tool-codegraph-read-v1",
          versionNumber: 1,
          digest: "sha256:tool-codegraph-read-v1",
          actionId: "codegraph.context",
          operationType: "READ",
        },
      ],
      assignedAgent: {
        agentId: "agent-rd-001",
        agentName: "AI研发员工",
        agentVersionRef: {
          kind: "AGENT",
          objectId: "agent-rd-001",
          versionId: "agent-rd-001-v1",
          versionNumber: 1,
          digest: "sha256:agent-rd-001-v1",
        },
        autonomyLevel: "L1辅助",
        humanOwner: { userId: "user-lead", displayName: "陈明" },
      },
      expectedArtifact: {
        artifactType: "技术方案",
        state: "EXPECTED",
        sections: [
          "目标理解",
          "范围与不做事项",
          "影响模块与文件",
          "技术决策",
          "风险",
          "测试建议",
          "回退考虑",
          "Knowledge Citation",
        ],
        knowledgeCitationRequired: true,
      },
      completionCriteria: ["结构完整"],
    });

    await interaction.click(screen.getByRole("button", { name: "提交 Task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Task 提交失败");
    expect(screen.getByText("可重试方案")).toBeVisible();
    await interaction.click(screen.getByRole("button", { name: "重试提交" }));

    await waitFor(() =>
      expect(repository.submitTechnicalSolutionTask).toHaveBeenCalledTimes(2),
    );
    expect(push).toHaveBeenCalledWith("/tasks/task-mock-0002");
  });

  it("preserves input and offers retry after a save failure", async () => {
    const interaction = userEvent.setup();
    renderWizard();
    await goToDefinition(interaction);
    repository.saveDraft
      .mockRejectedValueOnce(new Error("disk"))
      .mockImplementation(async (_scope, _actor, draft) => draft);
    await interaction.type(screen.getByLabelText("Task 标题"), "保留输入");
    await interaction.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("草稿保存失败");
    expect(screen.getByLabelText("Task 标题")).toHaveValue("保留输入");
    await interaction.click(screen.getByRole("button", { name: "重试保存" }));
    expect(repository.saveDraft).toHaveBeenCalledTimes(3);
  });
});
