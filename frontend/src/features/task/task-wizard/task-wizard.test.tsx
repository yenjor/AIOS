import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      screen.getByText("定义工作", { selector: "span" }).closest("li"),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText("Task 标题")).toHaveValue("恢复中的方案");
    expect(screen.getByLabelText("当前问题")).toHaveValue("恢复当前问题");
    expect(screen.getByLabelText("任务范围")).toHaveValue("恢复任务范围");
    expect(screen.getByLabelText("Priority")).toHaveValue(25);
    expect(screen.getByLabelText("期望完成时间")).not.toHaveValue("");
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

  it("revalidates every step at submit and focuses the first invalid field", async () => {
    const interaction = userEvent.setup();
    renderWizard({
      wizardStep: 5,
      templateName: "生成技术方案",
      riskLevel: "R1",
      priority: 50,
    });

    await interaction.click(screen.getByRole("button", { name: "提交 Task" }));

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
