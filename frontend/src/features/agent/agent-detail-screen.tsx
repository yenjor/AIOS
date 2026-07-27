"use client";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleOff,
  FileCheck2,
  GitBranch,
  PauseCircle,
  PlayCircle,
  Plus,
  Send,
  ShieldCheck,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TOOL_OPERATION_TYPE_LABELS } from "@/features/tool/tool-display";

import type {
  AgentAction,
  AgentActionState,
} from "./agent-detail-loader";
import { AgentStatusBadge } from "./agent-status-badge";
import {
  AGENT_PERMISSION_ACTION_LABELS,
  AGENT_PERMISSION_RESOURCE_LABELS,
  AGENT_TEST_RESULT_LABELS,
} from "./agent-display";
import type {
  Agent,
  AgentPermissionDecision,
  AgentVersion,
} from "./model";

const ownerNames: Record<string, string> = {
  "user-lead": "陈明",
  "user-admin": "吴桐",
  "user-pm": "林悦",
  "user-dev": "周航",
  "user-auditor": "赵岚",
};

function VersionDetail({ version }: { version: AgentVersion }) {
  const test = version.testSummaries.at(-1);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--aios-muted)]">
            AI 员工版本 v{version.versionNumber}
          </p>
          <h2 className="mt-1 break-all font-mono text-lg font-semibold">
            {version.id}
          </h2>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
            {version.contentDigest}
          </p>
        </div>
        <AgentStatusBadge status={version.status} />
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Bot size={18} aria-hidden="true" />
            AI 员工配置档案
          </h3>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">岗位名称</dt>
              <dd className="mt-1">{version.profile.jobTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                角色说明
              </dt>
              <dd className="mt-1 leading-6">
                {version.profile.roleDescription}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                任务类型 / 成果
              </dt>
              <dd className="mt-1 break-words">
                {version.profile.acceptedTaskTypes.join(", ")} →{" "}
                {version.profile.expectedArtifactTypes.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                自主等级
              </dt>
              <dd className="mt-1">
                <Badge tone="info">{version.autonomyLevel}</Badge>
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <UserRoundCheck size={18} aria-hidden="true" />
            人机协作
          </h3>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                人工负责人
              </dt>
              <dd className="mt-1">
                {ownerNames[version.humanOwnerId] ?? version.humanOwnerId}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                职责边界
              </dt>
              <dd className="mt-1 leading-6">
                {version.profile.responsibilityBoundary}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                升级策略
              </dt>
              <dd className="mt-1 leading-6">
                {version.profile.escalationPolicy}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="font-semibold">能力分配</h3>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {version.capabilityAssignments.map((reference) => (
            <div
              key={reference.versionId}
              className="min-w-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4"
            >
              <p className="break-all text-sm font-semibold">
                {reference.objectId}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                {reference.versionId}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                {reference.digest}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <BrainCircuit size={18} aria-hidden="true" />
            知识库范围
          </h3>
          {version.knowledgeScopeAssignments.length ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--aios-muted)]">
              {version.knowledgeScopeAssignments.map((assignment) => (
                <li key={assignment.scopeDigest}>
                  当前工作空间 · 内部及以下 ·
                  必须提供引用
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--aios-muted)]">
              未绑定知识范围。
            </p>
          )}
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Wrench size={18} aria-hidden="true" />
            工具授权引用
          </h3>
          {version.toolGrantReferences.length ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--aios-muted)]">
              {version.toolGrantReferences.map((grant) => (
                <li key={`${grant.toolVersionId}:${grant.action}`}>
                  <span className="font-mono">{grant.action}</span> ·{" "}
                  {TOOL_OPERATION_TYPE_LABELS[grant.operationType]} · {grant.riskCeiling}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--aios-muted)]">
              未绑定工具授权。
            </p>
          )}
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} aria-hidden="true" />
            权限要求
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {version.permissionRequirements.map((requirement) => (
              <Badge
                key={`${requirement.resource}:${requirement.action}`}
                tone="neutral"
              >
                {AGENT_PERMISSION_RESOURCE_LABELS[requirement.resource]}：
                {AGENT_PERMISSION_ACTION_LABELS[requirement.action]}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <FileCheck2 size={18} aria-hidden="true" />
          确定性测试门禁
        </h3>
        {test ? (
          <div className="mt-3">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2
                className="text-[var(--aios-success-foreground)]"
                size={17}
                aria-hidden="true"
              />
              <strong>{AGENT_TEST_RESULT_LABELS[test.result]}</strong> · 能力、知识库、工具、
              权限、成果、提示词注入全部通过
            </p>
            <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
              {test.evidenceReference}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
              {test.evidenceDigest}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--aios-muted)]">
            尚未执行测试；该草稿不可发布。
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="font-semibold">永久禁止事项</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--aios-muted)]">
          {version.profile.permanentProhibitions.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </section>
    </Card>
  );
}

export function AgentDetailScreen({
  item,
  permission,
  actionState,
  onAction,
  scopeLabels,
}: {
  item: Agent;
  permission: AgentPermissionDecision;
  actionState: AgentActionState;
  onAction: (
    action: AgentAction,
    versionId?: string,
    reason?: string,
  ) => Promise<void>;
  scopeLabels: { organizationName: string; workspaceName: string };
}) {
  const [selectedVersionId, setSelectedVersionId] = useState(
    item.publishedVersionId ?? item.versions.at(-1)!.id,
  );
  const latestVersionId = item.versions.at(-1)!.id;
  const previousLatestVersionIdRef = useRef(latestVersionId);
  useEffect(() => {
    setSelectedVersionId((current) => {
      if (previousLatestVersionIdRef.current !== latestVersionId) {
        return latestVersionId;
      }
      return item.versions.some(({ id }) => id === current)
        ? current
        : item.publishedVersionId ?? latestVersionId;
    });
    previousLatestVersionIdRef.current = latestVersionId;
  }, [item.publishedVersionId, item.versions, latestVersionId]);
  const selected =
    item.versions.find(({ id }) => id === selectedVersionId) ??
    item.versions.at(-1)!;
  const busy = actionState.status === "working";
  const testPassed = selected.testSummaries.at(-1)?.result === "PASSED";

  function suspend() {
    const reason = window.prompt(
      "请输入暂停原因。暂停后新任务将无法选择此 AI 员工。",
    );
    if (reason?.trim())
      void onAction("SUSPEND", undefined, reason.trim());
  }

  function disable() {
    if (
      window.confirm(
        "确认有序停用此 AI 员工？存在任务引用时操作会被领域规则拒绝。",
      )
    ) {
      void onAction("DISABLE");
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <Link
        href="/agents"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回 AI 员工中心
      </Link>

      <header className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--aios-primary)]">
              AI 员工聚合
            </p>
            <AgentStatusBadge status={item.status} />
          </div>
          <h1 className="mt-1 text-3xl font-semibold">{item.name}</h1>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
            {item.code} · {item.id}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            {item.roleDescription}
          </p>
          <p className="mt-2 text-xs text-[var(--aios-muted)]">
            {scopeLabels.organizationName} / {scopeLabels.workspaceName} ·
            人工负责人 {ownerNames[item.humanOwnerId] ?? item.humanOwnerId} ·
            聚合 v{item.aggregateVersion}
          </p>
        </div>
        {permission.canManage ? (
          <div className="flex flex-wrap gap-2">
            {item.status !== "DISABLED" &&
            item.versions.at(-1)?.status !== "DRAFT" ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void onAction("CREATE_VERSION")}
              >
                <Plus size={17} aria-hidden="true" />
                创建新版本
              </Button>
            ) : null}
            {selected.status === "DRAFT" ? (
              <Button
                disabled={busy}
                onClick={() => void onAction("TEST", selected.id)}
              >
                <Activity size={17} aria-hidden="true" />
                运行确定性测试
              </Button>
            ) : null}
            {selected.status === "DRAFT" && testPassed ? (
              <Button
                disabled={busy}
                onClick={() => void onAction("PUBLISH", selected.id)}
              >
                <Send size={17} aria-hidden="true" />
                发布并启用
              </Button>
            ) : null}
            {item.status === "ENABLED" ? (
              <>
                <Button variant="secondary" disabled={busy} onClick={suspend}>
                  <PauseCircle size={17} aria-hidden="true" />
                  暂停
                </Button>
                <Button variant="secondary" disabled={busy} onClick={disable}>
                  <CircleOff size={17} aria-hidden="true" />
                  有序停用
                </Button>
              </>
            ) : null}
            {item.status === "SUSPENDED" ? (
              <>
                <Button
                  disabled={busy}
                  onClick={() => void onAction("RESUME")}
                >
                  <PlayCircle size={17} aria-hidden="true" />
                  复核并恢复
                </Button>
                <Button variant="secondary" disabled={busy} onClick={disable}>
                  <CircleOff size={17} aria-hidden="true" />
                  有序停用
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-[var(--aios-control-border)] px-4 py-3 text-sm text-[var(--aios-muted)]">
            {permission.reason}
          </p>
        )}
      </header>

      {actionState.status === "working" ? (
        <Card
          role="status"
          aria-live="polite"
          className="mt-5 flex items-center gap-3 p-4"
        >
          <Activity
            className="animate-pulse text-[var(--aios-primary)] motion-reduce:animate-none"
            size={18}
            aria-hidden="true"
          />
          正在执行 {actionState.action}，写入前会验证状态、版本和权限…
        </Card>
      ) : actionState.status === "error" ? (
        <Card
          role="alert"
          className="mt-5 flex items-start gap-3 border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] p-4"
        >
          <AlertCircle
            className="mt-0.5 text-[var(--aios-error-foreground)]"
            size={18}
            aria-hidden="true"
          />
          <p className="text-sm">{actionState.message}</p>
        </Card>
      ) : null}

      {item.status === "SUSPENDED" && item.suspensionReason ? (
        <Card className="mt-5 flex items-start gap-3 border-[color-mix(in_srgb,var(--aios-warning)_35%,var(--aios-surface))] p-4">
          <PauseCircle
            className="mt-0.5 text-[var(--aios-warning-foreground)]"
            size={18}
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">暂停原因</p>
            <p className="mt-1 text-sm text-[var(--aios-muted)]">
              {item.suspensionReason}
            </p>
          </div>
        </Card>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <GitBranch size={18} aria-hidden="true" />
            AI 员工版本历史
          </h2>
          <div className="mt-4 grid gap-2">
            {[...item.versions]
              .sort((left, right) => right.versionNumber - left.versionNumber)
              .map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setSelectedVersionId(version.id)}
                  className={`min-h-11 rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)] ${
                    selected.id === version.id
                      ? "border-[var(--aios-primary)] bg-[color-mix(in_srgb,var(--aios-primary)_7%,var(--aios-surface))]"
                      : "border-[var(--aios-control-border)]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong>v{version.versionNumber}</strong>
                    <AgentStatusBadge status={version.status} />
                  </span>
                  <span className="mt-2 block break-all font-mono text-xs text-[var(--aios-muted)]">
                    {version.id}
                  </span>
                </button>
              ))}
          </div>
        </Card>
        <VersionDetail version={selected} />
      </section>

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} aria-hidden="true" />
          使用情况与运行时交集
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
          任务引用 {item.referencedTaskIds.length} 次。实际执行权限取 AI 员工身份、组织、工作空间、任务、AI 员工版本、
          能力版本、知识库范围、工具动作、风险、审批与
          自主等级的交集；任一维度拒绝即默认拒绝。
        </p>
        {item.referencedTaskIds.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.referencedTaskIds.map((taskId) => (
              <Link
                className="rounded-full border border-[var(--aios-control-border)] px-3 py-1 text-xs font-semibold"
                href={`/tasks/${taskId}`}
                key={taskId}
              >
                {taskId}
              </Link>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
