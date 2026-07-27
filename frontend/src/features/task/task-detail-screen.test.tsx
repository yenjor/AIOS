import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ToolInvocationResult } from "@/features/tool/model";

import type { PlannedTaskDetail } from "./model";
import { TaskDetailScreen } from "./task-detail-screen";

function plannedTask(): PlannedTaskDetail {
  return {
    id: "task-golden-technical-solution",
    scope: { organizationId: "org-guangwei", workspaceId: "ws-ai" },
    title: "生成 AIOS 任务中心技术方案",
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
      displayName: "AI 研发员工",
    },
    assignedAgentName: "AI 研发员工",
    participantUserIds: ["user-pm", "user-lead", "user-dev"],
    approverUserIds: ["user-lead"],
    reviewerUserIds: ["user-lead"],
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-26T07:50:00.000Z",
    goal: "形成可供研发团队评审并实施的任务中心技术方案",
    constraints: ["遵循现有 AIOS 架构", "固定版本引用后执行"],
    outOfScope: ["不执行未授权写入"],
    completionCriteria: [
      "技术方案符合结构要求",
      "关键结论包含知识库引用",
      "成果完成人工验收",
    ],
    assignedAgent: {
      agentId: "agent-rd-001",
      agentName: "AI 研发员工",
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
      assumptions: ["现有文档为唯一可信来源"],
      missingInformation: [],
      scopeDigest: "sha256:scope-task-golden-technical-solution",
      steps: [
        {
          id: "step-01",
          sequence: 1,
          name: "需求理解与约束确认",
          description: "明确目标与边界。",
          stepType: "AGENT",
          responsibility: "AI 研发员工",
          riskLevel: "R0",
        },
        {
          id: "step-02",
          sequence: 2,
          name: "代码与模块影响分析",
          description: "只读识别影响模块。",
          stepType: "KNOWLEDGE_RETRIEVAL",
          responsibility: "AI 研发员工",
          riskLevel: "R0",
        },
        {
          id: "step-03",
          sequence: 3,
          name: "形成技术方案草稿",
          description: "形成结构化草稿。",
          stepType: "AGENT",
          responsibility: "AI 研发员工",
          riskLevel: "R1",
        },
        {
          id: "step-04",
          sequence: 4,
          name: "方案结构和引用检查",
          description: "检查结构与引用。",
          stepType: "VALIDATION",
          responsibility: "验证",
          riskLevel: "R1",
        },
        {
          id: "step-05",
          sequence: 5,
          name: "成果人工验收",
          description: "由验收人验收。",
          stepType: "HUMAN_REVIEW",
          responsibility: "验收人",
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
        name: "成果验收",
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
        "知识库引用",
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

const invocation: ToolInvocationResult = {
  id: "invocation-task-golden-step-02",
  scope: { organizationId: "org-guangwei", workspaceId: "ws-ai" },
  taskId: "task-golden-technical-solution",
  runId: "run-task-golden-technical-solution-01",
  actorId: "user-lead",
  agentId: "agent-rd-001",
  agentVersionId: "agent-rd-001-v1",
  capabilityVersionIds: ["capability-technical-solution-v1"],
  toolId: "tool-codegraph-read",
  toolVersionId: "tool-codegraph-read-v1",
  toolVersionDigest: "sha256:tool-codegraph-read-v1",
  action: "codegraph.context",
  actionDigest: "sha256:codegraph-context-action-v1",
  operationType: "READ",
  riskLevel: "R0",
  status: "SUCCEEDED",
  idempotencyKey:
    "run-task-golden-technical-solution-01:step-02:codegraph.context:attempt-01",
  inputDigest: "sha256:input",
  outputDigest: "sha256:output",
  resultReference: "mcp://codegraph/invocation-task-golden-step-02",
  resultExcerpt: "TaskDetailLoader -> 工具代理 -> CodeGraph MCP",
  summary: "CodeGraph MCP 返回受控代码上下文。",
  requestedAt: "2026-07-27T08:00:00.000Z",
  completedAt: "2026-07-27T08:00:01.000Z",
  durationMs: 1_000,
  serverIdentity: "codegraph",
  serverVersion: "0.9.0",
  schemaDigest: "sha256:codegraph-context-output-v1",
  auditEvents: [
    {
      sequence: 1,
      eventType: "TOOL_INVOCATION_REQUESTED",
      occurredAt: "2026-07-27T08:00:00.000Z",
      summary: "工具调用已创建。",
    },
    {
      sequence: 2,
      eventType: "TOOL_PERMISSION_ALLOWED",
      occurredAt: "2026-07-27T08:00:00.000Z",
      summary: "权限交集校验通过。",
    },
    {
      sequence: 3,
      eventType: "MCP_SESSION_INITIALIZED",
      occurredAt: "2026-07-27T08:00:01.000Z",
      summary: "MCP 会话已初始化。",
    },
    {
      sequence: 4,
      eventType: "TOOL_INVOCATION_SUCCEEDED",
      occurredAt: "2026-07-27T08:00:01.000Z",
      summary: "结果已固定。",
    },
  ],
};

describe("TaskDetailScreen", () => {
  it("shows the governed 任务 identity and complete active scope", () => {
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-auditor", name: "赵岚", role: "审计员" }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "生成 AIOS 任务中心技术方案",
      }),
    ).toBeVisible();
    expect(screen.getByText("task-golden-technical-solution")).toBeVisible();
    expect(screen.getByLabelText("任务状态：待审批")).toBeVisible();
    expect(screen.getByText("优先级 50")).toBeVisible();
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
      name: "任务详情导航",
    });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "概览",
      "计划",
      "执行",
      "成果",
      "协作",
      "审计",
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

    for (const heading of ["概览", "计划", "执行", "成果", "协作", "审计"]) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeVisible();
    }
  });

  it("renders the five-step plan, immutable references, expected 成果 and approvals", () => {
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
      "成果人工验收",
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
      "读取 · 只读",
    ]) {
      expect(within(overview).getByText(reference)).toBeVisible();
    }

    const artifact = screen.getByRole("region", { name: "成果" });
    expect(within(artifact).getByText("技术方案")).toBeVisible();
    expect(within(artifact).getByText("尚未生成")).toBeVisible();
    expect(within(artifact).getByText("知识库引用")).toBeVisible();
    expect(within(artifact).getByText("需要知识库引用")).toBeVisible();

    expect(within(plan).getByText("计划确认")).toBeVisible();
    expect(within(plan).getByText("成果验收")).toBeVisible();
    expect(within(plan).getAllByText("待审批")).toHaveLength(2);
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
      screen.getByText(/当前任务停止在计划确认审批点/),
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
      "调用工具",
      "接受成果",
      "驳回成果",
      "要求成果返工",
    ];
    for (const actionName of controlledActions) {
      const action = screen.getByRole("button", { name: actionName });
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleDescription(
        "当前增量开放“计划批准 → 真实只读 MCP 工具调用 → LiteLLM 受控推理 → 结构化成果校验 → 人工验收”的首个 AI 员工闭环。",
      );
    }
    expect(
      screen.queryByRole("button", { name: "批准并开始执行" }),
    ).not.toBeInTheDocument();
  });

  it("allows only the fixed 验收人 to approve a submitted mutable 任务", async () => {
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
      screen.getByRole("button", { name: "接受成果" }),
    ).toBeDisabled();

    await interaction.click(approve);
    expect(onControlledAction).toHaveBeenCalledWith("批准计划");
  });

  it("shows only persisted collaboration and audit evidence", () => {
    render(
      <TaskDetailScreen
        task={plannedTask()}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-auditor", name: "赵岚", role: "审计员" }}
      />,
    );

    const collaboration = screen.getByRole("region", { name: "协作" });
    expect(collaboration).toHaveTextContent("user-pm");
    expect(collaboration).toHaveTextContent("user-lead");
    expect(collaboration).toHaveTextContent("user-dev");
    expect(collaboration).toHaveTextContent("只读");

    const audit = screen.getByRole("region", { name: "审计" });
    expect(within(audit).getAllByRole("listitem")).toHaveLength(4);
    expect(audit).toHaveTextContent("初始状态 → 草稿");
    expect(audit).toHaveTextContent("草稿 → 已就绪");
    expect(audit).toHaveTextContent("规划中 → 待审批");
    expect(audit).not.toHaveTextContent("已批准");
  });

  it("renders persisted MCP result and 工具代理 audit evidence", () => {
    const task = plannedTask();
    task.status = "EXECUTING";
    task.executionRun = {
      id: "run-task-golden-technical-solution-01",
      taskId: task.id,
      runNumber: 1,
      status: "RUNNING",
      workflowVersionId: task.workflowVersionRef.versionId,
      agentVersionId: task.assignedAgent.agentVersionRef.versionId,
      executionPackageDigest: "sha256:execution-package-v1",
      currentStepId: "step-03",
      currentCheckpointId: "checkpoint-step-02",
      idempotencyKey: "run-task-golden-technical-solution-01",
      workerPool: "agent-reasoning",
      attemptCount: 1,
      startedAt: "2026-07-27T07:59:00.000Z",
      checkpointedAt: "2026-07-27T08:00:01.000Z",
      steps: task.executionPlan.steps.map((step) => ({
        stepId: step.id,
        sequence: step.sequence,
        name: step.name,
        status: step.sequence <= 2 ? "SUCCEEDED" : "PENDING",
        ...(step.sequence === 5 ? { resultType: "HUMAN_REVIEW" as const } : {}),
      })),
      checkpoints: [],
    };

    render(
      <TaskDetailScreen
        task={task}
        toolInvocations={[invocation]}
        scopeLabels={scopeLabels}
        viewer={{ userId: "user-lead", name: "陈明", role: "研发负责人" }}
      />,
    );

    const execution = screen.getByRole("region", { name: "执行" });
    expect(execution).toHaveTextContent("真实 MCP 调用证据");
    expect(execution).toHaveTextContent("codegraph.context");
    expect(execution).toHaveTextContent("sha256:output");
    const audit = screen.getByRole("region", { name: "审计" });
    expect(audit).toHaveTextContent("MCP 会话已初始化");
    expect(audit).toHaveTextContent("工具调用成功");
  });

  it("supports an unplanned seed without fabricating plan or 成果 content", () => {
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
    expect(screen.getByRole("region", { name: "成果" })).toHaveTextContent(
      "尚未生成",
    );
    expect(screen.queryByText("capability-technical-solution-v1")).not.toBeInTheDocument();
  });

  it("shows an accepted 成果版本引用 for a completed 任务 without inventing content", () => {
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
        viewer={{ userId: "user-auditor", name: "赵岚", role: "审计员" }}
      />,
    );

    const artifact = screen.getByRole("region", { name: "成果" });
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
      "成果正文由独立只读视图提供；此处保留版本引用和验收状态。",
    );
  });

  it.each(["FAILED", "CANCELLED"] as const)(
    "shows the required execution summary evidence for a %s 任务",
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
          viewer={{ userId: "user-auditor", name: "赵岚", role: "审计员" }}
        />,
      );

      const artifact = screen.getByRole("region", { name: "成果" });
      expect(within(artifact).getByText("执行摘要 · 未接受")).toBeVisible();
      expect(
        within(artifact).getByText(
          `artifact-execution-summary-${status.toLowerCase()}-v1`,
        ),
      ).toBeVisible();
      expect(within(artifact).queryByText("尚未生成")).not.toBeInTheDocument();
      expect(artifact).toHaveTextContent(
        "成果正文由独立只读视图提供；此处保留版本引用和验收状态。",
      );
    },
  );
});
