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
  TaskDetail,
  VersionRef,
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
  | "接受 Artifact";

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
  { id: "task-artifact", label: "Artifact" },
  { id: "task-collaboration", label: "协作" },
  { id: "task-audit", label: "Audit" },
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
  "调用 Tool",
  "接受 Artifact",
  "驳回 Artifact",
  "要求 Artifact 返工",
] as const;

const SUPPORTED_ACTIONS = new Set<TaskDetailControlledAction>([
  "批准计划",
  "开始执行",
  "接受 Artifact",
]);

function userLabel(userId: string) {
  const name = USER_NAMES[userId];
  return name ? `${name}（${userId}）` : userId;
}

function actorName(displayName: string) {
  return displayName.replace("AI研发员工", "AI 研发员工");
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
        <Badge>{reference.kind}</Badge>
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-[var(--aios-muted)]">Object</dt>
          <dd className="mt-0.5 break-all font-mono">{reference.objectId}</dd>
        </div>
        <div>
          <dt className="text-[var(--aios-muted)]">VersionRef</dt>
          <dd className="mt-0.5 break-all font-mono">{reference.versionId}</dd>
        </div>
        <div>
          <dt className="text-[var(--aios-muted)]">Digest</dt>
          <dd className="mt-0.5 break-all font-mono">{reference.digest}</dd>
        </div>
        {actionId ? (
          <div>
            <dt className="text-[var(--aios-muted)]">Action</dt>
            <dd className="mt-0.5 break-all font-mono">{actionId}</dd>
          </div>
        ) : null}
        {operationType ? (
          <div>
            <dt className="text-[var(--aios-muted)]">Operation Type</dt>
            <dd className="mt-0.5 font-semibold">
              {operationType} · 只读
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
          ? "接受 Artifact"
          : undefined;
  const fixedReferences: DisplayVersionRef[] = [
    ...(task.assignedAgent
      ? [
          {
            label: "Agent",
            reference: task.assignedAgent.agentVersionRef,
          },
        ]
      : []),
    ...task.capabilityVersionRefs.map((reference) => ({
      label: "Capability",
      reference,
    })),
    ...task.knowledgeVersionRefs.map((reference) => ({
      label: "知识库",
      reference,
    })),
    ...task.toolVersionRefs.map((reference) => ({
      label: "Tool",
      reference,
      actionId: reference.actionId,
      operationType: reference.operationType,
    })),
    ...(task.workflowVersionRef
      ? [{ label: "Workflow", reference: task.workflowVersionRef }]
      : []),
  ];

  return (
    <article className="mx-auto max-w-[1600px]">
      <header className="rounded-[10px] border border-[color-mix(in_srgb,var(--aios-muted)_25%,var(--aios-surface))] bg-[var(--aios-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <Badge tone="info">Priority {task.priority}</Badge>
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
                : "当前身份仅可查看此 Task 的执行证据。"}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Building2 size={15} aria-hidden="true" />
              Organization
            </dt>
            <dd className="mt-1 text-sm font-semibold">{scopeLabels.organizationName}</dd>
            <dd className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
              {task.scope.organizationId}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Network size={15} aria-hidden="true" />
              Workspace
            </dt>
            <dd className="mt-1 text-sm font-semibold">{scopeLabels.workspaceName}</dd>
            <dd className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
              {task.scope.workspaceId}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Fingerprint size={15} aria-hidden="true" />
              Initiator
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold">
              {userLabel(task.initiator.userId)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="flex items-center gap-2 text-xs font-medium text-[var(--aios-muted)]">
              <Bot size={15} aria-hidden="true" />
              Agent / CurrentOwner
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {task.assignedAgentName
                ? actorName(task.assignedAgentName)
                : "尚未分配 Agent"}
            </dd>
            <dd className="mt-1 space-y-1 break-words text-xs text-[var(--aios-muted)]">
              <span className="block">
                CurrentOwner：
                {task.currentOwner
                  ? actorName(task.currentOwner.displayName)
                  : "尚未产生"}
              </span>
              {!task.currentOwner && task.assignedAgent ? (
                <span className="block">
                  Human Owner：{task.assignedAgent.humanOwner.displayName} ·{" "}
                  {task.assignedAgent.autonomyLevel.replace("L1辅助", "L1 辅助")}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </header>

      <nav
        aria-label="Task 详情导航"
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
                  <h3 className="font-semibold">Goal</h3>
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
                <h3 className="font-semibold">固定 VersionRef</h3>
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
                    ExecutionRun · AI Employee Runtime
                  </h3>
                  <Badge
                    tone={
                      task.executionRun.status === "SUCCEEDED"
                        ? "success"
                        : "info"
                    }
                  >
                    {task.executionRun.status}
                  </Badge>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-[var(--aios-muted)]">
                  {task.executionRun.id}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                    <dt className="text-xs text-[var(--aios-muted)]">
                      Runtime Progress
                    </dt>
                    <dd className="mt-1 font-semibold">
                      已完成 {completedRuntimeStepCount} / 4 个 Runtime Step
                    </dd>
                  </div>
                  <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                    <dt className="text-xs text-[var(--aios-muted)]">
                      Checkpoint
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {task.executionRun.checkpoints.length} 个持久化检查点
                    </dd>
                  </div>
                  <div className="rounded-lg bg-[var(--aios-canvas)] p-3 sm:col-span-2 xl:col-span-1">
                    <dt className="text-xs text-[var(--aios-muted)]">
                      Execution Package Digest
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs">
                      {task.executionRun.executionPackageDigest}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-5 text-[var(--aios-muted)]">
                  此 Runtime 会通过 Tool Broker 调用真实 CodeGraph MCP
                  只读 Action；Artifact 编排保持确定性，尚未调用外部 AI
                  模型、写入型 Tool 或生产系统。
                </p>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold">Step 与 Checkpoint</h3>
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
                          {step.status}
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
                  第 5 步是 Human Review，不由 Agent Runtime 自动完成。
                </p>
              </Card>

              {toolInvocations.length > 0 ? (
                <Card className="p-5 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      Tool Invocation · 真实 MCP 调用证据
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
                              {invocation.action} · {invocation.operationType}/
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
                            {invocation.status}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
                          {invocation.summary}
                        </p>
                        <dl className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              MCP Server
                            </dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.serverIdentity}@
                              {invocation.serverVersion}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              Duration
                            </dt>
                            <dd className="mt-1 font-mono">
                              {invocation.durationMs} ms
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              Input Digest
                            </dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.inputDigest}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">
                              Output Digest
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
                      Model Invocation · LiteLLM 推理证据
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
                            {invocation.status}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
                          {invocation.summary}
                        </p>
                        <dl className="mt-3 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">Model Policy</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.modelPolicyProfile}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">PromptVersion</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.promptVersionId}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">Duration</dt>
                            <dd className="mt-1 font-mono">
                              {invocation.durationMs} ms
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">Input Digest</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.inputDigest}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">Prompt Digest</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.promptDigest}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                            <dt className="text-[var(--aios-muted)]">Output Digest</dt>
                            <dd className="mt-1 break-all font-mono">
                              {invocation.outputDigest ?? "未确认"}
                            </dd>
                          </div>
                        </dl>
                        {invocation.usage ? (
                          <p className="mt-3 text-xs text-[var(--aios-muted)]">
                            Tokens：{invocation.usage.promptTokens} input /{" "}
                            {invocation.usage.completionTokens} output /{" "}
                            {invocation.usage.totalTokens} total
                          </p>
                        ) : null}
                        {invocation.errorClassification ? (
                          <p className="mt-3 break-all font-mono text-xs text-[var(--aios-error-foreground)]">
                            {invocation.errorClassification}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs leading-5 text-[var(--aios-muted)]">
                          出于数据最小化要求，此处只保存版本、Digest、用量和校验结果，不保存完整 Prompt。
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
                      ? "当前 Task 停止在计划确认审批点。Reviewer 批准后才创建 ExecutionRun。"
                      : `当前持久化状态为 ${TASK_STATUS_LABELS[task.status]}，尚无 ExecutionRun 证据。`}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </ReadonlySection>

        <ReadonlySection id="task-artifact" label="Artifact" icon={FileCheck2}>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">预期 Artifact</h3>
                <Badge tone="info">{task.expectedArtifact.artifactType}</Badge>
                <Badge>{task.expectedArtifact.state}</Badge>
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
              <h3 className="font-semibold">ArtifactVersionRef</h3>
              {task.artifactVersionRefs.length === 0 ? (
                <div className="mt-4 rounded-lg bg-[var(--aios-canvas)] p-4">
                  <p className="font-semibold">尚未生成</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
                    这里只展示已持久化的 Artifact 引用，不生成或推测交付内容。
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-xs leading-5 text-[var(--aios-muted)]">
                    Artifact 正文由独立 Read Model 提供；此处保留版本引用和验收状态。
                  </p>
                  <ul className="mt-4 space-y-3">
                    {task.artifactVersionRefs.map((reference) => (
                      <li key={reference.versionId}>
                        <Link
                          href={`/artifacts/${reference.objectId}`}
                          className="mb-2 inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-[var(--aios-primary)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
                        >
                          查看 Artifact {reference.objectId}
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
                  <h4 className="mt-5 text-sm font-semibold">CitationRef</h4>
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
                  Participant
                </dt>
                <dd className="mt-2 break-words text-sm leading-6">
                  {task.participantUserIds.map(userLabel).join("、") || "无"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[var(--aios-muted)]">
                  Approver
                </dt>
                <dd className="mt-2 break-words text-sm leading-6">
                  {task.approverUserIds.map(userLabel).join("、") || "无"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[var(--aios-muted)]">
                  Reviewer
                </dt>
                <dd className="mt-2 break-words text-sm leading-6">
                  {task.reviewerUserIds.map(userLabel).join("、") || "无"}
                </dd>
              </div>
            </dl>
          </Card>
        </ReadonlySection>

        <ReadonlySection id="task-audit" label="Audit" icon={History}>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">持久化状态历史</h3>
              <Badge>Aggregate v{task.aggregateVersion}</Badge>
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
                        {historyItem.fromStatus ?? "INITIAL"} →{" "}
                        {historyItem.toStatus}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                        {historyItem.reasonCode} ·{" "}
                        {historyItem.actor.actorType}:
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
                  <h4 className="font-semibold">Tool Broker Audit Event</h4>
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
                            {event.eventType}
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
                  <h4 className="font-semibold">Model Gateway Audit Event</h4>
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
                            {event.eventType}
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
            当前增量开放“计划批准 → 真实只读 MCP Tool Invocation →
            LiteLLM 受控推理 → 结构化 Artifact 校验 → 人工验收”的首个 AI 员工闭环。
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
            只有固定 Reviewer / Human Owner 可以推进；其余动作和 Auditor
            身份保持只读。
          </p>
          {actionState.status === "error" ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--aios-error)_12%,var(--aios-surface))] p-3 text-sm text-[var(--aios-error-foreground)]"
            >
              {actionState.message ??
                "受控动作未完成，Task 状态未被推测或覆盖。"}
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
