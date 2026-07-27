"use client";

import {
  Bot,
  Boxes,
  Building2,
  CircleAlert,
  CircleCheck,
  FileCheck2,
  Fingerprint,
  History,
  LoaderCircle,
  LockKeyhole,
  Network,
  PlayCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ModelInvocationResult } from "@/features/model-gateway/model";
import type { ToolInvocationResult } from "@/features/tool/model";
import type { DeepReadonly, WorkspaceRole } from "@/types/domain";

import { ExecutionPlan } from "./execution-plan";
import type {
  ExecutionRunStatus,
  ExecutionStepStatus,
  TaskDetail,
  VersionRef,
  VersionRefKind,
} from "./model";
import { TASK_STATUS_LABELS } from "./task-status";
import { TaskStatusBadge } from "./task-status-badge";

export interface TaskScopeLabels {
  organizationName: string;
  workspaceName: string;
}

export interface TaskDetailViewer {
  userId: string;
  name: string;
  role: WorkspaceRole;
}

export type TaskDetailControlledAction =
  | "批准计划"
  | "开始执行"
  | "接受成果";

export interface TaskDetailActionState {
  status: "idle" | "working" | "error";
  action?: TaskDetailControlledAction;
  message?: string;
}

export interface TaskDetailScreenProps {
  task: DeepReadonly<TaskDetail>;
  toolInvocations?: DeepReadonly<ToolInvocationResult[]>;
  modelInvocations?: DeepReadonly<ModelInvocationResult[]>;
  scopeLabels: TaskScopeLabels;
  viewer: TaskDetailViewer;
  actionState?: TaskDetailActionState;
  onControlledAction?: (
    action: TaskDetailControlledAction,
  ) => void | Promise<void>;
}

interface DisplayVersionRef {
  label: string;
  reference: DeepReadonly<VersionRef>;
  actionId?: string;
  operationType?: "READ";
}

const USER_NAMES: Readonly<Record<string, string>> = {
  "user-pm": "林悦",
  "user-dev": "周航",
  "user-lead": "陈明",
  "user-admin": "吴桐",
  "user-auditor": "赵岚",
};

const DETAIL_NAVIGATION = [
  { id: "task-overview", label: "概览" },
  { id: "task-plan", label: "计划" },
  { id: "task-execution", label: "执行" },
  { id: "task-artifact", label: "成果" },
  { id: "task-collaboration", label: "协作" },
  { id: "task-audit", label: "审计" },
] as const;

const CONTROLLED_ACTIONS = [
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
] as const;

const SUPPORTED_ACTIONS = new Set<TaskDetailControlledAction>([
  "批准计划",
  "开始执行",
  "接受成果",
]);

const EXECUTION_RUN_STATUS_LABELS: Record<ExecutionRunStatus, string> = {
  RUNNING: "执行中",
  SUCCEEDED: "执行成功",
};

const EXECUTION_STEP_STATUS_LABELS: Record<ExecutionStepStatus, string> = {
  PENDING: "等待执行",
  SUCCEEDED: "执行成功",
  WAITING_HUMAN: "等待人工处理",
};

const TOOL_INVOCATION_STATUS_LABELS: Record<
  ToolInvocationResult["status"],
  string
> = {
  SUCCEEDED: "调用成功",
  FAILED: "调用失败",
  DENIED: "已拒绝",
  UNKNOWN: "结果未知",
};

const MODEL_INVOCATION_STATUS_LABELS: Record<
  ModelInvocationResult["status"],
  string
> = {
  SUCCEEDED: "调用成功",
  FAILED: "调用失败",
  UNKNOWN: "结果未知",
};

const MODEL_ERROR_LABELS: Record<
  NonNullable<ModelInvocationResult["errorClassification"]>,
  string
> = {
  GATEWAY_NOT_CONFIGURED: "模型网关未配置",
  GATEWAY_UNAVAILABLE: "模型网关不可用",
  GATEWAY_TIMEOUT: "模型网关超时",
  RATE_LIMITED: "模型调用受限流",
  PROVIDER_ERROR: "模型提供方错误",
  OUTPUT_INVALID: "模型输出不符合结构要求",
};

const TOOL_AUDIT_EVENT_LABELS: Record<
  ToolInvocationResult["auditEvents"][number]["eventType"],
  string
> = {
  TOOL_INVOCATION_REQUESTED: "已请求工具调用",
  TOOL_PERMISSION_ALLOWED: "工具权限已放行",
  MCP_SESSION_INITIALIZED: "MCP 会话已初始化",
  TOOL_INVOCATION_SUCCEEDED: "工具调用成功",
  TOOL_INVOCATION_FAILED: "工具调用失败",
  TOOL_INVOCATION_UNKNOWN: "工具调用结果未知",
};

const MODEL_AUDIT_EVENT_LABELS: Record<
  ModelInvocationResult["auditEvents"][number]["eventType"],
  string
> = {
  MODEL_INVOCATION_REQUESTED: "已请求模型调用",
  MODEL_POLICY_ALLOWED: "模型策略已放行",
  MODEL_GATEWAY_DISPATCHED: "模型网关已分发",
  MODEL_RESPONSE_RECEIVED: "已收到模型响应",
  MODEL_OUTPUT_VALIDATED: "模型输出已验证",
  MODEL_INVOCATION_FAILED: "模型调用失败",
  MODEL_INVOCATION_UNKNOWN: "模型调用结果未知",
};

const VERSION_REF_KIND_LABELS: Record<VersionRefKind, string> = {
  AGENT: "AI 员工",
  CAPABILITY: "能力",
  KNOWLEDGE: "知识库",
  TOOL: "工具",
  WORKFLOW: "工作流",
  PLAN: "计划",
  ARTIFACT: "成果",
};

function userLabel(userId: string) {
  const name = USER_NAMES[userId];
  return name ? `${name}（${userId}）` : userId;
}

function actorName(displayName: string) {
  return displayName.replace("AI 研发员工", "AI 研发员工");
}

function ReferenceCard({
  label,
  reference,
  actionId,
  operationType,
  container = "li",
}: {
  label: string;
  reference: DeepReadonly<VersionRef>;
  actionId?: string;
  operationType?: "READ";
  container?: "li" | "div";
}) {
  const Root = container;
  return (
    <Root className="min-w-0 rounded-lg border border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
          {label}
        </span>
        <Badge>{VERSION_REF_KIND_LABELS[reference.kind]}</Badge>
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-[var(--aios-muted)]">对象</dt>
          <dd className="mt-0.5 break-all font-mono">{reference.objectId}</dd>
        </div>
        <div>
          <dt className="text-[var(--aios-muted)]">版本引用</dt>
          <dd className="mt-0.5 break-all font-mono">{reference.versionId}</dd>
        </div>
        <div>
          <dt className="text-[var(--aios-muted)]">摘要</dt>
          <dd className="mt-0.5 break-all font-mono">{reference.digest}</dd>
        </div>
        {actionId ? (
          <div>
            <dt className="text-[var(--aios-muted)]">动作</dt>
            <dd className="mt-0.5 break-all font-mono">{actionId}</dd>
          </div>
        ) : null}
        {operationType ? (
          <div>
            <dt className="text-[var(--aios-muted)]">操作类型</dt>
            <dd className="mt-0.5 font-semibold">
              读取 · 只读
            </dd>
          </div>
        ) : null}
      </dl>
    </Root>
  );
}

function ReadonlySection({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: typeof Boxes;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      role="region"
      aria-label={label}
      className="scroll-mt-6"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon
          size={20}
          className="text-[var(--aios-primary)]"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold">{label}</h2>
      </div>
      {children}
    </section>
  );
}

export function TaskDetailScreen({
  task,
  toolInvocations = [],
  modelInvocations = [],
  scopeLabels,
  viewer,
  actionState = { status: "idle" },
  onControlledAction,
}: TaskDetailScreenProps) {
  const controlledActionDescriptionId = `${useId()}-controlled-actions`;
  const isMutableMockTask = task.id.startsWith("task-mock-");
  const isHumanOwner = task.assignedAgent?.humanOwner.userId === viewer.userId;
  const isReviewer = task.reviewerUserIds.includes(viewer.userId);
  const completedRuntimeStepCount =
    task.executionRun?.steps
      .slice(0, 4)
      .filter(({ status }) => status === "SUCCEEDED").length ?? 0;
  const enabledAction: TaskDetailControlledAction | undefined =
    isMutableMockTask &&
    isReviewer &&
    task.status === "NEED_APPROVAL"
      ? "批准计划"
      : isMutableMockTask &&
          isHumanOwner &&
          task.status === "EXECUTING"
        ? "开始执行"
        : isMutableMockTask &&
            isReviewer &&
            task.status === "REVIEW"
          ? "接受成果"
          : undefined;
  const fixedReferences: DisplayVersionRef[] = [
    ...(task.assignedAgent
      ? [
          {
            label: "AI 员工",
            reference: task.assignedAgent.agentVersionRef,
          },
        ]
      : []),
    ...task.capabilityVersionRefs.map((reference) => ({
      label: "能力",
      reference,
    })),
    ...task.knowledgeVersionRefs.map((reference) => ({
      label: "知识库",
      reference,
    })),
    ...task.toolVersionRefs.map((reference) => ({
      label: "工具",
      reference,
      actionId: reference.actionId,
      operationType: reference.operationType,
    })),
    ...(task.workflowVersionRef
      ? [{ label: "工作流", reference: task.workflowVersionRef }]
      : []),
  ];

  return (
    <article className="mx-auto max-w-[1600px]">
      <header className="rounded-[10px] border border-[color-mix(in_srgb,var(--aios-muted)_25%,var(--aios-surface))] bg-[var(--aios-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <Badge tone="info">优先级 {task.priority}</Badge>
              <Badge tone={task.riskLevel === "R0" ? "success" : "warning"}>
                {task.riskLevel}
              </Badge>
              <Badge>{task.templateName}</Badge>
            </div>
            <p className="mt-4 break-all font-mono text-xs text-[var(--aios-muted)]">
              {task.id}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {task.title}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--aios-muted)]">
              {task.goalSummary}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] px-4 py-3 text-sm">
            <p className="font-semibold">
              {viewer.name}（{viewer.role}）
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
              {enabledAction
                ? `当前可执行受控动作：${enabledAction}`
                : "当前身份仅可查看此任务的执行证据。"}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Building2 size={15} aria-hidden="true" />
              组织
            </dt>
            <dd className="mt-1 text-sm font-semibold">{scopeLabels.organizationName}</dd>
            <dd className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
              {task.scope.organizationId}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Network size={15} aria-hidden="true" />
              工作空间
            </dt>
            <dd className="mt-1 text-sm font-semibold">{scopeLabels.workspaceName}</dd>
            <dd className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
              {task.scope.workspaceId}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Fingerprint size={15} aria-hidden="true" />
              发起人
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold">
              {userLabel(task.initiator.userId)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Bot size={15} aria-hidden="true" />
              AI 员工 / 当前负责人
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {task.assignedAgentName
                ? actorName(task.assignedAgentName)
                : "尚未分配 AI 员工"}
            </dd>
            <dd className="mt-1 space-y-1 break-words text-xs text-[var(--aios-muted)]">
              <span className="block">
                当前负责人：
                {task.currentOwner
                  ? actorName(task.currentOwner.displayName)
                  : "尚未产生"}
              </span>
              {!task.currentOwner && task.assignedAgent ? (
                <span className="block">
                  人工负责人：{task.assignedAgent.humanOwner.displayName} ·{" "}
                  {task.assignedAgent.autonomyLevel.replace("L1辅助", "L1 辅助")}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </header>

      <nav
        aria-label="任务详情导航"
        className="sticky top-0 z-10 mt-5 overflow-x-auto rounded-[10px] border border-[color-mix(in_srgb,var(--aios-muted)_25%,var(--aios-surface))] bg-[var(--aios-surface)] p-2 shadow-sm"
      >
        <div className="flex min-w-max gap-1">
          {DETAIL_NAVIGATION.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-[var(--aios-muted)] transition hover:bg-[var(--aios-canvas)] hover:text-[var(--aios-text)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-7 space-y-9">
        <ReadonlySection id="task-overview" label="概览" icon={Boxes}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
            <Card className="min-w-0 p-5">
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold">目标</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                    {task.goal}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">当前问题</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                    {task.goalSummary}
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">约束</h3>
                    {task.constraints.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--aios-muted)]">
                        {task.constraints.map((constraint) => (
                          <li key={constraint}>{constraint}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--aios-muted)]">
                        无已记录约束
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">范围 / 不做事项</h3>
                    {task.outOfScope.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--aios-muted)]">
                        {task.outOfScope.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--aios-muted)]">
                        无已记录不做事项
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="min-w-0 p-5">
              <div className="flex items-center gap-2">
                <LockKeyhole
                  size={18}
                  className="text-[var(--aios-primary)]"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">固定版本引用</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--aios-muted)]">
                仅展示引用身份与摘要；知识正文不会在此页面展开。
              </p>
              {fixedReferences.length > 0 ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {fixedReferences.map(
                    ({ label, reference, actionId, operationType }) => (
                    <ReferenceCard
                      key={`${label}-${reference.versionId}`}
                      label={label}
                      reference={reference}
                      actionId={actionId}
                      operationType={operationType}
                    />
                    ),
                  )}
                </ul>
              ) : (
                <p className="mt-4 rounded-lg bg-[var(--aios-canvas)] p-4 text-sm text-[var(--aios-muted)]">
                  计划固定引用尚未生成。
                </p>
              )}
            </Card>
          </div>
        </ReadonlySection>

        <ReadonlySection id="task-plan" label="计划" icon={Network}>
          <ExecutionPlan
            plan={task.executionPlan}
            expectedArtifact={task.expectedArtifact}
            completionCriteria={task.completionCriteria}
            approvalPoints={task.approvalPoints}
          />
        </ReadonlySection>

        <ReadonlySection id="task-execution" label="执行" icon={PlayCircle}>
          {task.executionRun ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    执行记录 · AI 员工运行时
                  </h3>
                  <Badge
                    tone={
                      task.executionRun.status === "SUCCEEDED"
                        ? "success"
                        : "info"
                    }
                  >
                    {EXECUTION_RUN_STATUS_LABELS[task.executionRun.status]}
                  </Badge>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-[var(--aios-muted)]">
                  {task.executionRun.id}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                    <dt className="text-xs text-[var(--aios-muted)]">
                      运行时进度
                    </dt>
                    <dd className="mt-1 font-semibold">
                      已完成 {completedRuntimeStepCount} / 4 个运行时步骤
                    </dd>
                  </div>
                  <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                    <dt className="text-xs text-[var(--aios-muted)]">
                      检查点
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {task.executionRun.checkpoints.length} 个持久化检查点
                    </dd>
                  </div>
                  <div className="rounded-lg bg-[var(--aios-canvas)] p-3 sm:col-span-2 xl:col-span-1">
                    <dt className="text-xs text-[var(--aios-muted)]">
                      执行包摘要
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs">
                      {task.executionRun.executionPackageDigest}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-5 text-[var(--aios-muted)]">
                  此运行时会通过工具代理调用真实 CodeGraph MCP
                  只读动作；成果编排保持确定性，尚未调用外部 AI
                  模型、写入型工具或生产系统。
                </p>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold">步骤与检查点</h3>
                <ol className="mt-4 space-y-3">
                  {task.executionRun.steps.map((step) => (
                    <li
                      key={step.stepId}
                      className="rounded-lg border border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {step.status === "SUCCEEDED" ? (
                            <CircleCheck
                              className="shrink-0 text-[var(--aios-success-foreground)]"
                              size={18}
                              aria-hidden="true"
                            />
                          ) : (
                            <CircleAlert
                              className="shrink-0 text-[var(--aios-warning-foreground)]"
                              size={18}
                              aria-hidden="true"
                            />
                          )}
                          <span className="text-sm font-semibold">
                            {step.sequence}. {step.name}
                          </span>
                        </div>
                        <Badge
                          tone={
                            step.status === "SUCCEEDED"
                              ? "success"
                              : step.status === "WAITING_HUMAN"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {EXECUTION_STEP_STATUS_LABELS[step.status]}
                        </Badge>
                      </div>
                      {step.summary ? (
                        <p className="mt-2 text-xs leading-5 text-[var(--aios-muted)]">
                          {step.summary}
                        </p>
                      ) : null}
                      {step.outputReference ? (
                        <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
                          {step.outputReference}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs leading-5 text-[var(--aios-muted)]">
                  第 5 步是人工验收，不由 AI 员工运行时自动完成。
                </p>
              </Card>

              {toolInvocations.length > 0 ? (
                <Card className="p-5 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      工具调用 · 真实 MCP 调用证据
                    </h3>
                    <Badge tone="info">{toolInvocations.length} 次调用</Badge>
                  </div>
                  <ol className="mt-4 space-y-4">
                    {toolInvocations.map((invocation) => (
                      <li
                        key={invocation.id}
                        className="rounded-lg border border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-[var(--aios-muted)]">
                              {invocation.id}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {invocation.action} · 读取/
                              {invocation.riskLevel}
                            </p>
                          </div>
                          <Badge
                            tone={
                              invocation.status === "SUCCEEDED"
                                ? "success"
                                : invocation.status === "UNKNOWN"
                                  ? "warning"
                                  : "error"
                            }
                          >
                            {TOOL_INVOCATION_STATUS_LABELS[invocation.status]}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
                          {invocation.summary}
                        </p>
                        <dl className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              MCP 服务
                            </dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.serverIdentity}@
                              {invocation.serverVersion}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              耗时
                            </dt>
                            <dd className="mt-1 font-mono">
                              {invocation.durationMs} ms
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              输入摘要
                            </dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.inputDigest}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              输出摘要
                            </dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.outputDigest ?? "未确认"}
                            </dd>
                          </div>
                        </dl>
                        {invocation.resultExcerpt ? (
                          <details className="mt-3 rounded-lg bg-[var(--aios-canvas)] p-3">
                            <summary className="cursor-pointer text-sm font-semibold">
                              查看结果摘要
                            </summary>
                            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-[var(--aios-muted)]">
                              {invocation.resultExcerpt}
                            </pre>
                          </details>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </Card>
              ) : null}
              {modelInvocations.length > 0 ? (
                <Card className="p-5 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      模型调用 · LiteLLM 推理证据
                    </h3>
                    <Badge tone="info">{modelInvocations.length} 次调用</Badge>
                  </div>
                  <ol className="mt-4 space-y-4">
                    {modelInvocations.map((invocation) => (
                      <li
                        key={invocation.id}
                        className="rounded-lg border border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-[var(--aios-muted)]">
                              {invocation.id}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {invocation.modelAlias} →{" "}
                              {invocation.resolvedModel ?? "未解析"}
                            </p>
                          </div>
                          <Badge
                            tone={
                              invocation.status === "SUCCEEDED"
                                ? "success"
                                : invocation.status === "UNKNOWN"
                                  ? "warning"
                                  : "error"
                            }
                          >
                            {MODEL_INVOCATION_STATUS_LABELS[invocation.status]}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
                          {invocation.summary}
                        </p>
                        <dl className="mt-3 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">模型策略</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.modelPolicyProfile}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">提示词版本</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.promptVersionId}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">耗时</dt>
                            <dd className="mt-1 font-mono">
                              {invocation.durationMs} ms
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">输入摘要</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.inputDigest}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">提示词摘要</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.promptDigest}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">输出摘要</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.outputDigest ?? "未确认"}
                            </dd>
                          </div>
                        </dl>
                        {invocation.usage ? (
                          <p className="mt-3 text-xs text-[var(--aios-muted)]">
                            词元：输入 {invocation.usage.promptTokens} /{" "}
                            输出 {invocation.usage.completionTokens} /{" "}
                            总计 {invocation.usage.totalTokens}
                          </p>
                        ) : null}
                        {invocation.errorClassification ? (
                          <p className="mt-3 break-all font-mono text-xs text-[var(--aios-error-foreground)]">
                            {MODEL_ERROR_LABELS[invocation.errorClassification]}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs leading-5 text-[var(--aios-muted)]">
                          出于数据最小化要求，此处只保存版本、摘要、用量和校验结果，不保存完整提示词。
                        </p>
                      </li>
                    ))}
                  </ol>
                </Card>
              ) : null}
            </div>
          ) : (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <CircleAlert
                  className="mt-0.5 shrink-0 text-[var(--aios-warning-foreground)]"
                  size={20}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">尚未开始</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                    {task.status === "NEED_APPROVAL"
                      ? "当前任务停止在计划确认审批点。验收人批准后才创建执行记录。"
                      : `当前持久化状态为 ${TASK_STATUS_LABELS[task.status]}，尚无执行记录证据。`}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </ReadonlySection>

        <ReadonlySection id="task-artifact" label="成果" icon={FileCheck2}>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">预期成果</h3>
                <Badge tone="info">{task.expectedArtifact.artifactType}</Badge>
                <Badge>预期</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--aios-muted)]">
                {task.expectedArtifact.knowledgeCitationRequired
                  ? "需要知识库引用"
                  : "未要求知识库引用"}
              </p>
              <h4 className="mt-4 text-sm font-semibold">结构要求</h4>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {task.expectedArtifact.sections.map((section) => (
                  <li
                    key={section}
                    className="rounded-lg bg-[var(--aios-canvas)] px-3 py-2 text-sm"
                  >
                    {section}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold">成果版本引用</h3>
              {task.artifactVersionRefs.length === 0 ? (
                <div className="mt-4 rounded-lg bg-[var(--aios-canvas)] p-4">
                  <p className="font-semibold">尚未生成</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
                    这里只展示已持久化的成果引用，不生成或推测交付内容。
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-xs leading-5 text-[var(--aios-muted)]">
                    成果正文由独立只读视图提供；此处保留版本引用和验收状态。
                  </p>
                  <ul className="mt-4 space-y-3">
                    {task.artifactVersionRefs.map((reference) => (
                      <li key={reference.versionId}>
                        <Link
                          href={`/artifacts/${reference.objectId}`}
                          className="mb-2 inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-[var(--aios-primary)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
                        >
                          查看成果 {reference.objectId}
                        </Link>
                        <ReferenceCard
                          label={`${reference.artifactType} · ${
                            reference.accepted ? "已接受" : "未接受"
                          }`}
                          reference={reference}
                          container="div"
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {task.citationRefs.length > 0 ? (
                <>
                  <h4 className="mt-5 text-sm font-semibold">知识引用</h4>
                  <ul className="mt-2 space-y-2 text-xs text-[var(--aios-muted)]">
                    {task.citationRefs.map((citation) => (
                      <li key={`${citation.locator}-${citation.digest}`}>
                        <span className="break-all font-mono">{citation.locator}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>
          </div>
        </ReadonlySection>

        <ReadonlySection id="task-collaboration" label="协作" icon={Users}>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">参与者与责任边界</h3>
              <Badge>只读</Badge>
            </div>
            <dl className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[var(--aios-muted)]">
                  参与人
                </dt>
                <dd className="mt-2 break-words text-sm leading-6">
                  {task.participantUserIds.map(userLabel).join("、") || "无"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[var(--aios-muted)]">
                  审批人
                </dt>
                <dd className="mt-2 break-words text-sm leading-6">
                  {task.approverUserIds.map(userLabel).join("、") || "无"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[var(--aios-muted)]">
                  验收人
                </dt>
                <dd className="mt-2 break-words text-sm leading-6">
                  {task.reviewerUserIds.map(userLabel).join("、") || "无"}
                </dd>
              </div>
            </dl>
          </Card>
        </ReadonlySection>

        <ReadonlySection id="task-audit" label="审计" icon={History}>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">持久化状态历史</h3>
              <Badge>聚合 v{task.aggregateVersion}</Badge>
            </div>
            {task.history.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {task.history.map((historyItem) => (
                  <li
                    key={historyItem.id}
                    className="grid gap-2 rounded-lg bg-[var(--aios-canvas)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {historyItem.fromStatus
                          ? TASK_STATUS_LABELS[historyItem.fromStatus]
                          : "初始状态"} →{" "}
                        {TASK_STATUS_LABELS[historyItem.toStatus]}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                        状态变更 ·{" "}
                        {historyItem.actor.actorType === "USER" ? "用户" : "AI 员工"}：
                        {historyItem.actor.actorId}
                      </p>
                    </div>
                    <div className="text-xs text-[var(--aios-muted)] sm:text-right">
                      <p>v{historyItem.aggregateVersion}</p>
                      <time dateTime={historyItem.occurredAt}>
                        {historyItem.occurredAt}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-[var(--aios-muted)]">
                无持久化历史记录。
              </p>
            )}
            {toolInvocations.length > 0 ? (
              <>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] pt-5">
                  <h4 className="font-semibold">工具代理审计事件</h4>
                  <Badge>
                    {toolInvocations.reduce(
                      (total, invocation) =>
                        total + invocation.auditEvents.length,
                      0,
                    )}{" "}
                    条证据
                  </Badge>
                </div>
                <ol className="mt-4 space-y-3">
                  {toolInvocations.flatMap((invocation) =>
                    invocation.auditEvents.map((event) => (
                      <li
                        key={`${invocation.id}-${event.sequence}`}
                        className="grid gap-2 rounded-lg bg-[var(--aios-canvas)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {TOOL_AUDIT_EVENT_LABELS[event.eventType]}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
                            {event.summary}
                          </p>
                          <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                            {invocation.id}
                          </p>
                        </div>
                        <time
                          className="text-xs text-[var(--aios-muted)] sm:text-right"
                          dateTime={event.occurredAt}
                        >
                          {event.occurredAt}
                        </time>
                      </li>
                    )),
                  )}
                </ol>
              </>
            ) : null}
            {modelInvocations.length > 0 ? (
              <>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] pt-5">
                  <h4 className="font-semibold">模型网关审计事件</h4>
                  <Badge>
                    {modelInvocations.reduce(
                      (total, invocation) =>
                        total + invocation.auditEvents.length,
                      0,
                    )}{" "}
                    条证据
                  </Badge>
                </div>
                <ol className="mt-4 space-y-3">
                  {modelInvocations.flatMap((invocation) =>
                    invocation.auditEvents.map((event) => (
                      <li
                        key={`${invocation.id}-${event.sequence}`}
                        className="grid gap-2 rounded-lg bg-[var(--aios-canvas)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {MODEL_AUDIT_EVENT_LABELS[event.eventType]}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
                            {event.summary}
                          </p>
                          <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                            {invocation.id}
                          </p>
                        </div>
                        <time
                          className="text-xs text-[var(--aios-muted)] sm:text-right"
                          dateTime={event.occurredAt}
                        >
                          {event.occurredAt}
                        </time>
                      </li>
                    )),
                  )}
                </ol>
              </>
            ) : null}
          </Card>
        </ReadonlySection>
      </div>

      <section
        aria-labelledby={`${controlledActionDescriptionId}-title`}
        className="mt-9"
      >
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <LockKeyhole
              size={19}
              className="text-[var(--aios-warning-foreground)]"
              aria-hidden="true"
            />
            <h2
              id={`${controlledActionDescriptionId}-title`}
              className="text-xl font-semibold"
            >
              受控动作
            </h2>
          </div>
          <p
            id={controlledActionDescriptionId}
            className="mt-2 text-sm leading-6 text-[var(--aios-muted)]"
          >
            当前增量开放“计划批准 → 真实只读 MCP 工具调用 →
            LiteLLM 受控推理 → 结构化成果校验 → 人工验收”的首个 AI 员工闭环。
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
            只有固定验收人 / 人工负责人可以推进；其余动作和审计员身份保持只读。
          </p>
          {actionState.status === "error" ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--aios-error)_12%,var(--aios-surface))] p-3 text-sm text-[var(--aios-error-foreground)]"
            >
              {actionState.message ??
                "受控动作未完成，任务状态未被推测或覆盖。"}
            </p>
          ) : null}
          {actionState.status === "working" ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-4 flex items-center gap-2 text-sm text-[var(--aios-muted)]"
            >
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                size={17}
                aria-hidden="true"
              />
              正在执行：{actionState.action}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {CONTROLLED_ACTIONS.map((action) => {
              const supported = SUPPORTED_ACTIONS.has(
                action as TaskDetailControlledAction,
              );
              const active = action === enabledAction;
              const disabled =
                !supported ||
                !active ||
                !onControlledAction ||
                actionState.status === "working";
              return (
                <Button
                  key={action}
                  variant={active ? "primary" : "secondary"}
                  disabled={disabled}
                  aria-describedby={controlledActionDescriptionId}
                  aria-busy={
                    actionState.status === "working" &&
                    actionState.action === action
                  }
                  title={
                    active
                      ? `执行受控动作：${action}`
                      : supported
                        ? "当前状态或身份不允许此受控动作"
                        : "当前增量尚未启用此受控动作"
                  }
                  onClick={
                    active
                      ? () => {
                          void onControlledAction?.(
                            action as TaskDetailControlledAction,
                          );
                        }
                      : undefined
                  }
                >
                  {action}
                </Button>
              );
            })}
          </div>
        </Card>
      </section>
    </article>
  );
}
