"use client";

import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  FileClock,
  Fingerprint,
  GitBranch,
  Link2,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  KNOWLEDGE_CLASSIFICATION_LABELS,
  KNOWLEDGE_CORRECTION_STATUS_LABELS,
  KNOWLEDGE_ITEM_STATUS_LABELS,
  KNOWLEDGE_PIPELINE_STAGE_LABELS,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
} from "./knowledge-display";
import {
  KnowledgeEffectiveBadge,
  KnowledgeIndexBadge,
} from "./knowledge-status-badge";
import type {
  KnowledgeItem,
  KnowledgePermissionDecision,
  KnowledgeVersion,
} from "./model";

const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]";

const ownerNames: Record<string, string> = {
  "user-lead": "陈明",
  "user-admin": "吴桐",
  "user-pm": "林悦",
  "user-dev": "周航",
};

export type KnowledgeDetailAction =
  | "PUBLISH"
  | "INVALIDATE"
  | "RESTORE"
  | "CORRECT";

export type KnowledgeDetailActionState =
  | { status: "idle" }
  | { status: "working"; action: KnowledgeDetailAction; versionId: string }
  | { status: "error"; message: string };

export interface KnowledgeDetailScreenProps {
  item: KnowledgeItem;
  permission: KnowledgePermissionDecision;
  scopeLabels: {
    organizationName: string;
    workspaceName: string;
  };
  actionState: KnowledgeDetailActionState;
  onVersionAction: (
    action: "PUBLISH" | "INVALIDATE" | "RESTORE",
    versionId: string,
    reason: string,
  ) => Promise<void>;
  onCorrection: (
    versionId: string,
    reason: string,
    evidenceReference: string,
  ) => Promise<void>;
}

function ClassificationBadge({
  classification,
}: {
  classification: KnowledgeItem["classification"];
}) {
  return (
    <Badge
      tone={
        classification === "CONFIDENTIAL"
          ? "error"
          : classification === "INTERNAL"
            ? "warning"
            : "info"
      }
    >
      {KNOWLEDGE_CLASSIFICATION_LABELS[classification]}
    </Badge>
  );
}

function VersionCard({
  item,
  version,
  permission,
  actionState,
  onVersionAction,
}: {
  item: KnowledgeItem;
  version: KnowledgeVersion;
  permission: KnowledgePermissionDecision;
  actionState: KnowledgeDetailActionState;
  onVersionAction: KnowledgeDetailScreenProps["onVersionAction"];
}) {
  const [reason, setReason] = useState("");
  const working =
    actionState.status === "working" &&
    actionState.versionId === version.id;
  const isCurrent = item.effectiveVersionId === version.id;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">
              版本 {version.versionNumber}
            </h3>
            <KnowledgeEffectiveBadge status={version.effectiveStatus} />
            <KnowledgeIndexBadge status={version.indexStatus} />
            {isCurrent ? <Badge tone="info">当前有效引用</Badge> : null}
          </div>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
            {version.id}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--aios-muted)]">
            {version.contentPreview}
          </p>
        </div>

        {permission.canManage ? (
          <div className="w-full shrink-0 space-y-3 xl:w-80">
            {version.effectiveStatus === "DRAFT" &&
            version.indexStatus === "READY" ? (
              <Button
                className="w-full"
                disabled={working}
                onClick={() =>
                  void onVersionAction("PUBLISH", version.id, "")
                }
              >
                <Send size={17} aria-hidden="true" />
                {working ? "正在发布…" : "发布为有效版本"}
              </Button>
            ) : null}
            {version.effectiveStatus === "EFFECTIVE" ? (
              <>
                <label
                  className="text-xs font-semibold"
                  htmlFor={`invalidate-${version.id}`}
                >
                  失效原因
                </label>
                <textarea
                  id={`invalidate-${version.id}`}
                  className={`${inputClass} min-h-20 resize-y`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="说明失效原因，至少 8 个字符"
                />
                <Button
                  className="w-full"
                  variant="danger"
                  disabled={working || reason.trim().length < 8}
                  onClick={() =>
                    void onVersionAction("INVALIDATE", version.id, reason)
                  }
                >
                  <XCircle size={17} aria-hidden="true" />
                  {working ? "正在失效…" : "使版本失效"}
                </Button>
              </>
            ) : null}
            {version.effectiveStatus === "INVALIDATED" &&
            version.indexStatus === "READY" ? (
              <>
                <label
                  className="text-xs font-semibold"
                  htmlFor={`restore-${version.id}`}
                >
                  恢复原因
                </label>
                <textarea
                  id={`restore-${version.id}`}
                  className={`${inputClass} min-h-20 resize-y`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="说明恢复原因，至少 8 个字符"
                />
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={working || reason.trim().length < 8}
                  onClick={() =>
                    void onVersionAction("RESTORE", version.id, reason)
                  }
                >
                  <RotateCcw size={17} aria-hidden="true" />
                  {working ? "正在恢复…" : "恢复为有效版本"}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
          <dt className="text-xs text-[var(--aios-muted)]">内容摘要</dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {version.contentDigest}
          </dd>
        </div>
        <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
          <dt className="text-xs text-[var(--aios-muted)]">原始内容引用</dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {version.rawContentReference.objectKey}
          </dd>
        </div>
        <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
          <dt className="text-xs text-[var(--aios-muted)]">创建</dt>
          <dd className="mt-1 text-xs">
            {version.createdBy} ·{" "}
            <time dateTime={version.createdAt}>{version.createdAt}</time>
          </dd>
        </div>
        <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
          <dt className="text-xs text-[var(--aios-muted)]">替代版本</dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {version.supersedesVersionId ?? "首个版本"}
          </dd>
        </div>
      </dl>

      {version.invalidationReason ? (
        <p className="mt-4 rounded-lg border border-[var(--aios-control-border)] p-3 text-sm">
          失效证据：{version.invalidationReason}
        </p>
      ) : null}

      <details className="mt-4 rounded-lg border border-[var(--aios-control-border)] p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          查看处理管道与验证证据
        </summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <ol className="space-y-3">
            {version.pipelineStages.map((stage) => (
              <li
                key={stage.name}
                className="flex items-start gap-3 rounded-lg bg-[var(--aios-canvas)] p-3"
              >
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
                  size={18}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold">
                    {KNOWLEDGE_PIPELINE_STAGE_LABELS[stage.name]} · {stage.processorVersion}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
                    {stage.summary}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              ["解析器", version.parserVersion],
              ["分块器", version.chunkerVersion],
              ["向量化", version.embeddingModelVersion],
              ["索引版本", String(version.indexVersion)],
              [
                "分块数量",
                String(version.validationSummary.chunkCount),
              ],
              [
                "引用覆盖率",
                `${Math.round(
                  version.validationSummary.citationCoverage * 100,
                )}%`,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-[var(--aios-canvas)] p-3"
              >
                <dt className="text-xs text-[var(--aios-muted)]">{label}</dt>
                <dd className="mt-1 break-all font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </Card>
  );
}

export function KnowledgeDetailScreen({
  item,
  permission,
  scopeLabels,
  actionState,
  onVersionAction,
  onCorrection,
}: KnowledgeDetailScreenProps) {
  const versions = useMemo(
    () =>
      [...item.versions].sort(
        (left, right) => right.versionNumber - left.versionNumber,
      ),
    [item.versions],
  );
  const hasDraft = versions.some(
    ({ effectiveStatus }) => effectiveStatus === "DRAFT",
  );
  const [correctionVersionId, setCorrectionVersionId] = useState(
    item.effectiveVersionId ?? versions[0]?.id ?? "",
  );
  const [correctionReason, setCorrectionReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");

  return (
    <article className="mx-auto max-w-[1500px]">
      <header className="rounded-[10px] border border-[color-mix(in_srgb,var(--aios-muted)_25%,var(--aios-surface))] bg-[var(--aios-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ClassificationBadge classification={item.classification} />
              <Badge tone={item.status === "ACTIVE" ? "success" : "warning"}>
                {KNOWLEDGE_ITEM_STATUS_LABELS[item.status]}
              </Badge>
              <Badge>{KNOWLEDGE_SOURCE_TYPE_LABELS[item.source.sourceType]}</Badge>
            </div>
            <p className="mt-4 break-all font-mono text-xs text-[var(--aios-muted)]">
              {item.id} · {item.code}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {item.title}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--aios-muted)]">
              {item.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/knowledge"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              返回知识库
            </Link>
            {permission.canManage && !hasDraft ? (
              <Link
                href={`/knowledge/${item.id}/versions/new`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-[var(--aios-surface)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
              >
                <GitBranch size={17} aria-hidden="true" />
                创建新版本
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">组织</dt>
            <dd className="mt-1 text-sm font-semibold">
              {scopeLabels.organizationName}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">工作空间</dt>
            <dd className="mt-1 text-sm font-semibold">
              {scopeLabels.workspaceName}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">负责人</dt>
            <dd className="mt-1 text-sm font-semibold">
              {ownerNames[item.ownerId] ?? item.ownerId}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">
              聚合版本
            </dt>
            <dd className="mt-1 font-mono text-xs">
              {item.aggregateVersion}
            </dd>
          </div>
        </dl>
      </header>

      {actionState.status === "error" ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] bg-[var(--aios-surface)] p-4"
        >
          <AlertCircle
            className="mt-0.5 shrink-0 text-[var(--aios-error-foreground)]"
            size={20}
            aria-hidden="true"
          />
          <p className="text-sm">{actionState.message}</p>
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section aria-labelledby="knowledge-source-title">
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint
              size={20}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h2 id="knowledge-source-title" className="text-xl font-semibold">
              来源、权限与适用范围
            </h2>
          </div>
          <Card className="p-5">
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--aios-muted)]">来源位置</dt>
                <dd className="mt-1 break-all text-sm">
                  {item.source.sourceLocation}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--aios-muted)]">来源权威性</dt>
                <dd className="mt-1 text-sm">
                  {item.source.sourceAuthority}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--aios-muted)]">可管理</dt>
                <dd className="mt-1 text-sm">
                  {permission.canManage ? "是" : "否"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--aios-muted)]">权限决策</dt>
                <dd className="mt-1 text-sm">{permission.reason}</dd>
              </div>
            </dl>
            <ul className="mt-5 space-y-3">
              {item.applicableScopes.map((scope) => (
                <li
                  key={scope.scopeDigest}
                  className="rounded-lg bg-[var(--aios-canvas)] p-3"
                >
                  <p className="text-sm font-semibold">
                    工作空间 · {scope.scopeId}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--aios-muted)]">
                    软件工程任务 · {scope.scopeDigest}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="knowledge-references-title">
          <div className="mb-3 flex items-center gap-2">
            <Link2
              size={20}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h2
              id="knowledge-references-title"
              className="text-xl font-semibold"
            >
              下游固定引用
            </h2>
          </div>
          <Card className="p-5">
            <p className="text-sm leading-6 text-[var(--aios-muted)]">
              任务和能力仅保存知识库版本引用；历史执行继续保留原版本证据。
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold text-[var(--aios-muted)]">
                任务
              </p>
              {item.referencedTaskIds.length ? (
                <ul className="mt-2 space-y-2">
                  {item.referencedTaskIds.map((taskId) => (
                    <li key={taskId}>
                      <Link
                        href={`/tasks/${taskId}`}
                        className="break-all font-mono text-xs underline hover:text-[var(--aios-primary)]"
                      >
                        {taskId}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm">无</p>
              )}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-[var(--aios-muted)]">
                能力
              </p>
              <p className="mt-2 text-sm">
                {item.referencedCapabilityIds.length
                  ? item.referencedCapabilityIds.join("、")
                  : "无"}
              </p>
            </div>
          </Card>
        </section>
      </div>

      <section className="mt-7" aria-labelledby="knowledge-versions-title">
        <div className="mb-3 flex items-center gap-2">
          <FileClock
            size={20}
            className="text-[var(--aios-primary)]"
            aria-hidden="true"
          />
          <h2 id="knowledge-versions-title" className="text-xl font-semibold">
            版本历史与处理证据
          </h2>
        </div>
        <div className="space-y-4">
          {versions.map((version) => (
            <VersionCard
              key={version.id}
              item={item}
              version={version}
              permission={permission}
              actionState={actionState}
              onVersionAction={onVersionAction}
            />
          ))}
        </div>
      </section>

      <section
        className="mt-7 grid gap-5 xl:grid-cols-2"
        aria-labelledby="knowledge-correction-title"
      >
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={20}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h2 id="knowledge-correction-title" className="text-xl font-semibold">
              纠错反馈
            </h2>
          </div>
          {permission.canSubmitCorrection ? (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  try {
                    await onCorrection(
                      correctionVersionId,
                      correctionReason,
                      evidenceReference,
                    );
                    setCorrectionReason("");
                    setEvidenceReference("");
                  } catch {
                    // 加载器会呈现数据仓储错误并保留表单。
                  }
                })();
              }}
            >
              <div>
                <label
                  className="mb-2 block text-sm font-semibold"
                  htmlFor="correction-version"
                >
                  目标版本
                </label>
                <select
                  id="correction-version"
                  className={inputClass}
                  value={correctionVersionId}
                  onChange={(event) =>
                    setCorrectionVersionId(event.target.value)
                  }
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.versionNumber} · {version.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-semibold"
                  htmlFor="correction-reason"
                >
                  纠错原因
                </label>
                <textarea
                  required
                  id="correction-reason"
                  className={`${inputClass} min-h-24 resize-y`}
                  value={correctionReason}
                  onChange={(event) =>
                    setCorrectionReason(event.target.value)
                  }
                  placeholder="描述错误、影响和建议修正，至少 8 个字符"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-semibold"
                  htmlFor="correction-evidence"
                >
                  证据引用
                </label>
                <input
                  required
                  id="correction-evidence"
                  className={inputClass}
                  value={evidenceReference}
                  onChange={(event) =>
                    setEvidenceReference(event.target.value)
                  }
                  placeholder="docs/reviews/review-2026-07.md"
                />
              </div>
              <Button
                type="submit"
                disabled={
                  actionState.status === "working" ||
                  correctionReason.trim().length < 8 ||
                  !evidenceReference.trim()
                }
              >
                <Send size={17} aria-hidden="true" />
                提交纠错
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--aios-muted)]">
              当前只读审计身份不能提交纠错，但可查看已授权处理证据。
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <BookOpenCheck
              size={20}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold">纠错记录</h2>
          </div>
          {item.correctionRequests.length ? (
            <ul className="mt-5 space-y-3">
              {item.correctionRequests
                .slice()
                .reverse()
                .map((correction) => (
                  <li
                    key={correction.id}
                    className="rounded-lg bg-[var(--aios-canvas)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">
                        {KNOWLEDGE_CORRECTION_STATUS_LABELS[correction.status]}
                      </Badge>
                      <span className="break-all font-mono text-xs">
                        {correction.targetVersionId}
                      </span>
                    </div>
                    <p className="mt-3 text-sm">{correction.reason}</p>
                    <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
                      {correction.evidenceReference}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--aios-muted)]">
              当前没有纠错记录。
            </p>
          )}
        </Card>
      </section>
    </article>
  );
}
