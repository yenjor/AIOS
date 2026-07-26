"use client";

import {
  Bot,
  Boxes,
  Building2,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  History,
  LockKeyhole,
  Network,
  PlayCircle,
  Users,
} from "lucide-react";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  name: string;
  role: WorkspaceRole;
}

export interface TaskDetailScreenProps {
  task: DeepReadonly<TaskDetail>;
  scopeLabels: TaskScopeLabels;
  viewer: TaskDetailViewer;
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
}: {
  label: string;
  reference: DeepReadonly<VersionRef>;
  actionId?: string;
  operationType?: "READ";
}) {
  return (
    <li className="min-w-0 rounded-lg border border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] p-3">
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
    </li>
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
  scopeLabels,
  viewer,
}: TaskDetailScreenProps) {
  const controlledActionDescriptionId = `${useId()}-controlled-actions`;
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
      label: "Knowledge",
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
              {viewer.name}（{viewer.role}）可只读查看
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
              当前页面不改变 Task、Plan、Approval 或 Artifact。
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
                仅展示引用身份与摘要；Knowledge 正文不会在此页面展开。
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
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <CircleAlert
                className="mt-0.5 shrink-0 text-[var(--aios-warning-foreground)]"
                size={20}
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold">
                  {task.history.some(({ toStatus }) => toStatus === "EXECUTING")
                    ? "执行详情未在当前增量开放"
                    : "尚未开始"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                  {task.status === "NEED_APPROVAL"
                    ? "当前 Task 停止在计划确认审批点。"
                    : `当前持久化状态为 ${TASK_STATUS_LABELS[task.status]}，本页不模拟 Runtime、Step 或 Tool 调用。`}
                </p>
              </div>
            </div>
          </Card>
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
                  ? "需要 Knowledge Citation"
                  : "未要求 Knowledge Citation"}
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
                    仅显示 ArtifactVersionRef 证据，正文未在当前 read model 提供。
                  </p>
                  <ul className="mt-4 space-y-3">
                    {task.artifactVersionRefs.map((reference) => (
                      <ReferenceCard
                        key={reference.versionId}
                        label={`${reference.artifactType} · ${
                          reference.accepted ? "已接受" : "未接受"
                        }`}
                        reference={reference}
                      />
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
                        {historyItem.reasonCode} · {historyItem.actor.userId}
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
            当前增量仅开放 Task 只读详情，受控动作将在对应引擎和权限流程实现后启用。
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
            审批、Artifact 与 Audit 的专用页面尚未实现，本页仅提供只读证据。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {CONTROLLED_ACTIONS.map((action) => (
              <Button
                key={action}
                variant="secondary"
                disabled
                aria-describedby={controlledActionDescriptionId}
                title="当前增量尚未启用此受控动作"
              >
                {action}
              </Button>
            ))}
          </div>
        </Card>
      </section>
    </article>
  );
}
