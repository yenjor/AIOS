import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlannedTaskDetail } from "./model";
import { TaskDetailScreen } from "./task-detail-screen";

function plannedTask(): PlannedTaskDetail {
  return {
    id: "task-golden-technical-solution",
    scope: { organizationId: "org-guangwei", workspaceId: "ws-ai" },
    title: "生成 AIOS Task Center 技术方案",
    goalSummary: "形成可供研发团队评审并实施的方案",
    templateName: "生成技术方案",
    expectedArtifactType: "技术方案",
    status: "NEED_APPROVAL",
    priority: 50,
    riskLevel: "R1",
    initiator: { userId: "user-pm" },
    currentOwner: {
      actorType: "AGENT",
      actorId: "agent-rd-001",
      displayName: "AI研发员工",
    },
    assignedAgentName: "AI研发员工",
    participantUserIds: ["user-pm", "user-lead", "user-dev"],
    approverUserIds: ["user-lead"],
    reviewerUserIds: ["user-lead"],
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-26T07:50:00.000Z",
    goal: "形成可供研发团队评审并实施的 Task Center 技术方案",
    constraints: ["遵循现有 AIOS 架构", "固定 VersionRef 后执行"],
    outOfScope: ["不执行未授权写入"],
    completionCriteria: [
      "技术方案符合结构要求",
      "关键结论包含 Knowledge Citation",
      "Artifact 完成人工验收",
    ],
    assignedAgent: {
      agentId: "agent-rd-001",
      agentName: "AI研发员工",
      autonomyLevel: "L1辅助",
      humanOwner: { userId: "user-lead", displayName: "陈明" },
      agentVersionRef: {
        kind: "AGENT",
        objectId: "agent-rd-001",
        versionId: "agent-rd-001-v1",
        versionNumber: 1,
        digest: "sha256:agent-rd-001-v1",
      },
    },
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
    workflowVersionRef: {
      kind: "WORKFLOW",
      objectId: "workflow-technical-solution",
      versionId: "workflow-technical-solution-v1",
      versionNumber: 1,
      digest: "sha256:workflow-technical-solution-v1",
    },
    executionPlan: {
      versionRef: {
        kind: "PLAN",
        objectId: "plan-task-golden-technical-solution",
        versionId: "plan-task-golden-technical-solution-v1",
        versionNumber: 1,
        digest: "sha256:plan-task-golden-technical-solution-v1",
      },
      goalInterpretation: "在现有 AIOS 架构边界内形成可评审、可实施的技术方案。",
      assumptions: ["现有文档为 Single Source of Truth"],
      missingInformation: [],
      scopeDigest: "sha256:scope-task-golden-technical-solution",
      steps: [
        {
          id: "step-01",
          sequence: 1,
          name: "需求理解与约束确认",
          description: "明确目标与边界。",
          stepType: "AGENT",
          responsibility: "AI研发员工",
          riskLevel: "R0",
        },
        {
          id: "step-02",
          sequence: 2,
          name: "代码与模块影响分析",
          description: "只读识别影响模块。",
          stepType: "KNOWLEDGE_RETRIEVAL",
          responsibility: "AI研发员工",
          riskLevel: "R0",
        },
        {
          id: "step-03",
          sequence: 3,
          name: "形成技术方案草稿",
          description: "形成结构化草稿。",
          stepType: "AGENT",
          responsibility: "AI研发员工",
          riskLevel: "R1",
        },
        {
          id: "step-04",
          sequence: 4,
          name: "方案结构和引用检查",
          description: "检查结构与引用。",
          stepType: "VALIDATION",
          responsibility: "Validation",
          riskLevel: "R1",
        },
        {
          id: "step-05",
          sequence: 5,
          name: "Artifact人工验收",
          description: "由 Reviewer 验收。",
          stepType: "HUMAN_REVIEW",
          responsibility: "Reviewer",
          riskLevel: "R1",
        },
      ],
    },
    approvalPoints: [
      {
        id: "approval-plan",
        name: "计划确认",
        requiredFor: "PLAN_EXECUTION",
        riskLevel: "R1",
        status: "PENDING",
        reviewerUserIds: ["user-lead"],
      },
      {
        id: "approval-artifact",
        name: "Artifact验收",
        requiredFor: "ARTIFACT_ACCEPTANCE",
        riskLevel: "R1",
        status: "PENDING",
        reviewerUserIds: ["user-lead"],
      },
    ],
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
    artifactVersionRefs: [],
    citationRefs: [],
    history: [
      {
        id: "transition-01",
        fromStatus: null,
        toStatus: "DRAFT",
        reasonCode: "TASK_CREATED",
        actor: { actorType: "USER", actorId: "user-pm" },
        occurredAt: "2026-07-25T08:00:00.000Z",
        aggregateVersion: 1,
      },
      {
        id: "transition-02",
        fromStatus: "DRAFT",
        toStatus: "READY",
        reasonCode: "TASK_READY",
        actor: { actorType: "USER", actorId: "user-pm" },
        occurredAt: "2026-07-25T08:01:00.000Z",
        aggregateVersion: 2,
      },
      {
        id: "transition-03",
        fromStatus: "READY",
        toStatus: "PLANNING",
        reasonCode: "TASK_PLANNING",
        actor: { actorType: "USER", actorId: "user-pm" },
        occurredAt: "2026-07-25T08:02:00.000Z",
        aggregateVersion: 3,
      },
      {
        id: "transition-04",
        fromStatus: "PLANNING",
        toStatus: "NEED_APPROVAL",
        reasonCode: "TASK_NEED_APPROVAL",
        actor: { actorType: "USER", actorId: "user-pm" },
        occurredAt: "2026-07-25T08:03:00.000Z",
        aggregateVersion: 4,
      },
    ],
    aggregateVersion: 4,
  };
}

const scopeLabels = {
  organizationName: "光位科技",
  workspaceName: "AI 智能业务线",
};

describe("TaskDetailScreen", () => {
  it("shows the governed Task identity and complete active scope", () => {
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-auditor", name: "赵岚", role: "Auditor" }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "生成 AIOS Task Center 技术方案",
      }),
    ).toBeVisible();
    expect(screen.getByText("task-golden-technical-solution")).toBeVisible();
    expect(screen.getByText("待审批")).toBeVisible();
    expect(screen.getByText("Priority 50")).toBeVisible();
    expect(screen.getAllByText("R1").length).toBeGreaterThan(0);
    expect(screen.getByText("光位科技")).toBeVisible();
    expect(screen.getByText("org-guangwei")).toBeVisible();
    expect(screen.getByText("AI 智能业务线")).toBeVisible();
    expect(screen.getByText("ws-ai")).toBeVisible();
    expect(screen.getAllByText(/林悦/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI 研发员工/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/陈明/).length).toBeGreaterThan(0);
  });

  it("provides six keyboard-focusable in-page navigation targets", async () => {
    const interaction = userEvent.setup();
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-lead", name: "陈明", role: "研发负责人" }}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Task 详情导航",
    });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "概览",
      "计划",
      "执行",
      "Artifact",
      "协作",
      "Audit",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#task-overview",
      "#task-plan",
      "#task-execution",
      "#task-artifact",
      "#task-collaboration",
      "#task-audit",
    ]);

    await interaction.tab();
    expect(links).toContain(document.activeElement);

    for (const heading of ["概览", "计划", "执行", "Artifact", "协作", "Audit"]) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeVisible();
    }
  });

  it("renders the five-step plan, immutable references, expected Artifact and approvals", () => {
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-lead", name: "陈明", role: "研发负责人" }}
      />,
    );

    const plan = screen.getByRole("region", { name: "计划" });
    expect(within(plan).getAllByRole("listitem", { name: /步骤/ })).toHaveLength(5);
    for (const stepName of [
      "需求理解与约束确认",
      "代码与模块影响分析",
      "形成技术方案草稿",
      "方案结构和引用检查",
      "Artifact人工验收",
    ]) {
      expect(within(plan).getByText(stepName)).toBeVisible();
    }
    expect(within(plan).getByText("plan-task-golden-technical-solution-v1")).toBeVisible();
    expect(within(plan).getByText("sha256:plan-task-golden-technical-solution-v1")).toBeVisible();
    expect(within(plan).getByText("sha256:scope-task-golden-technical-solution")).toBeVisible();

    const overview = screen.getByRole("region", { name: "概览" });
    for (const reference of [
      "agent-rd-001-v1",
      "capability-technical-solution-v1",
      "knowledge-aios-docs-v1",
      "tool-codegraph-read-v1",
      "workflow-technical-solution-v1",
      "codegraph.context",
      "READ · 只读",
    ]) {
      expect(within(overview).getByText(reference)).toBeVisible();
    }

    const artifact = screen.getByRole("region", { name: "Artifact" });
    expect(within(artifact).getByText("技术方案")).toBeVisible();
    expect(within(artifact).getByText("尚未生成")).toBeVisible();
    expect(within(artifact).getByText("Knowledge Citation")).toBeVisible();
    expect(within(artifact).getByText("需要 Knowledge Citation")).toBeVisible();

    expect(within(plan).getByText("计划确认")).toBeVisible();
    expect(within(plan).getByText("Artifact验收")).toBeVisible();
    expect(within(plan).getAllByText("PENDING")).toHaveLength(2);
  });

  it("keeps execution and all future actions visibly controlled and disabled", () => {
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-lead", name: "陈明", role: "研发负责人" }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "执行" }),
    ).toHaveTextContent("尚未开始");
    expect(
      screen.getByText(/当前 Task 停止在计划确认审批点/),
    ).toBeVisible();
    expect(
      screen.getByText(/当前增量开放“计划批准/),
    ).toBeVisible();

    const controlledActions = [
      "补充信息",
      "批准计划",
      "驳回计划",
      "要求调整计划",
      "开始执行",
      "暂停",
      "恢复",
      "取消",
      "人工接管",
      "调用 Tool",
      "接受 Artifact",
      "驳回 Artifact",
      "要求 Artifact 返工",
    ];
    for (const actionName of controlledActions) {
      const action = screen.getByRole("button", { name: actionName });
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleDescription(
        "当前增量开放“计划批准 → 确定性 Mock Runtime → Artifact 验收”的首个 AI 员工闭环。",
      );
    }
    expect(
      screen.queryByRole("button", { name: "批准并开始执行" }),
    ).not.toBeInTheDocument();
  });

  it("allows only the fixed Reviewer to approve a submitted mutable Task", async () => {
    const interaction = userEvent.setup();
    const task = plannedTask();
    task.id = "task-mock-0001";
    const onControlledAction = vi.fn();

    render(
      <TaskDetailScreen
        task={task}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-lead", name: "陈明", role: "研发负责人" }}
        onControlledAction={onControlledAction}
      />,
    );

    const approve = screen.getByRole("button", { name: "批准计划" });
    expect(approve).toBeEnabled();
    expect(screen.getByRole("button", { name: "开始执行" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "接受 Artifact" }),
    ).toBeDisabled();

    await interaction.click(approve);
    expect(onControlledAction).toHaveBeenCalledWith("批准计划");
  });

  it("shows only persisted collaboration and audit evidence", () => {
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-auditor", name: "赵岚", role: "Auditor" }}
      />,
    );

    const collaboration = screen.getByRole("region", { name: "协作" });
    expect(collaboration).toHaveTextContent("user-pm");
    expect(collaboration).toHaveTextContent("user-lead");
    expect(collaboration).toHaveTextContent("user-dev");
    expect(collaboration).toHaveTextContent("只读");

    const audit = screen.getByRole("region", { name: "Audit" });
    expect(within(audit).getAllByRole("listitem")).toHaveLength(4);
    expect(audit).toHaveTextContent("TASK_CREATED");
    expect(audit).toHaveTextContent("DRAFT");
    expect(audit).toHaveTextContent("NEED_APPROVAL");
    expect(audit).not.toHaveTextContent("已批准");
  });

  it("supports an unplanned seed without fabricating plan or Artifact content", () => {
    const unplanned = plannedTask();
    const compatibleTask = {
      ...unplanned,
      status: "DRAFT" as const,
      assignedAgent: undefined,
      assignedAgentName: undefined,
      currentOwner: undefined,
      workflowVersionRef: undefined,
      executionPlan: undefined,
      capabilityVersionRefs: [],
      knowledgeVersionRefs: [],
      toolVersionRefs: [],
      approvalPoints: [],
      history: [unplanned.history[0]],
      aggregateVersion: 1,
    };

    render(
      <TaskDetailScreen
        task={compatibleTask}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-dev", name: "周航", role: "开发工程师" }}
      />,
    );

    expect(screen.getByRole("region", { name: "计划" })).toHaveTextContent(
      "计划尚未生成",
    );
    expect(screen.getByRole("region", { name: "Artifact" })).toHaveTextContent(
      "尚未生成",
    );
    expect(screen.queryByText("capability-technical-solution-v1")).not.toBeInTheDocument();
  });

  it("shows an accepted ArtifactVersionRef for a completed Task without inventing content", () => {
    const completedTask = plannedTask();
    completedTask.status = "COMPLETED";
    completedTask.artifactVersionRefs = [
      {
        kind: "ARTIFACT",
        objectId: "artifact-deliverable-task-completed",
        versionId: "artifact-deliverable-task-completed-v1",
        versionNumber: 1,
        digest: "sha256:artifact-deliverable-task-completed-v1",
        artifactType: "技术方案",
        accepted: true,
      },
    ];

    render(
      <TaskDetailScreen
        task={completedTask}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-auditor", name: "赵岚", role: "Auditor" }}
      />,
    );

    const artifact = screen.getByRole("region", { name: "Artifact" });
    expect(within(artifact).getByText("技术方案 · 已接受")).toBeVisible();
    expect(
      within(artifact).getByText("artifact-deliverable-task-completed-v1"),
    ).toBeVisible();
    expect(
      within(artifact).getByText(
        "sha256:artifact-deliverable-task-completed-v1",
      ),
    ).toBeVisible();
    expect(within(artifact).queryByText("尚未生成")).not.toBeInTheDocument();
    expect(artifact).toHaveTextContent(
      "Artifact 正文由独立 Read Model 提供；此处保留版本引用和验收状态。",
    );
  });

  it.each(["FAILED", "CANCELLED"] as const)(
    "shows the required execution summary evidence for a %s Task",
    (status) => {
      const terminalTask = plannedTask();
      terminalTask.status = status;
      terminalTask.artifactVersionRefs = [
        {
          kind: "ARTIFACT",
          objectId: `artifact-execution-summary-${status.toLowerCase()}`,
          versionId: `artifact-execution-summary-${status.toLowerCase()}-v1`,
          versionNumber: 1,
          digest: `sha256:artifact-execution-summary-${status.toLowerCase()}-v1`,
          artifactType: "执行摘要",
          accepted: false,
        },
      ];

      render(
        <TaskDetailScreen
          task={terminalTask}
          scopeLabels={scopeLabels}
          viewer={{ userId: "user-auditor", name: "赵岚", role: "Auditor" }}
        />,
      );

      const artifact = screen.getByRole("region", { name: "Artifact" });
      expect(within(artifact).getByText("执行摘要 · 未接受")).toBeVisible();
      expect(
        within(artifact).getByText(
          `artifact-execution-summary-${status.toLowerCase()}-v1`,
        ),
      ).toBeVisible();
      expect(within(artifact).queryByText("尚未生成")).not.toBeInTheDocument();
      expect(artifact).toHaveTextContent(
        "Artifact 正文由独立 Read Model 提供；此处保留版本引用和验收状态。",
      );
    },
  );
});
