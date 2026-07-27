"use client";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  PauseCircle,
  PlayCircle,
  Plus,
  Send,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { CapabilityAction, CapabilityActionState } from "./capability-detail-loader";
import { CapabilityStatusBadge } from "./capability-status-badge";
import type { Capability, CapabilityPermissionDecision, CapabilityVersion } from "./model";

const taskTypeLabels = {
  GENERATE_TECHNICAL_DESIGN: "生成技术方案",
  ANALYZE_REQUIREMENT: "分析需求",
  CODE_REVIEW: "代码审查",
  AUTOMATED_TEST: "自动测试",
} as const;

const evaluationLabels = {
  PASSED: "已通过",
  FAILED: "未通过",
  BLOCKED: "已阻断",
} as const;

const permissionResourceLabels = {
  WORKSPACE: "工作空间",
  KNOWLEDGE: "知识库",
  TOOL: "工具",
  ARTIFACT: "成果",
} as const;

const permissionActionLabels = {
  READ: "读取",
  USE: "使用",
  CREATE_DRAFT: "创建草稿",
} as const;

const artifactTypeLabels = {
  TECHNICAL_DESIGN: "技术方案",
  REQUIREMENT_ANALYSIS: "需求分析报告",
  CODE_REVIEW_REPORT: "代码审查报告",
  TEST_REPORT: "测试报告",
} as const;

const ownerNames: Record<string, string> = {
  "user-lead": "陈明", "user-admin": "吴桐", "user-pm": "林悦", "user-dev": "周航",
};

function RefCard({ label, objectId, versionId, digest }: { label: string; objectId: string; versionId: string; digest: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold">{objectId}</p>
      <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">{versionId}</p>
      <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">{digest}</p>
    </div>
  );
}

function VersionDetail({ version }: { version: CapabilityVersion }) {
  const evaluation = version.evaluationSummaries.at(-1);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--aios-muted)]">能力版本 v{version.versionNumber}</p>
          <h2 className="mt-1 break-all font-mono text-lg font-semibold">{version.id}</h2>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">{version.contentDigest}</p>
        </div>
        <CapabilityStatusBadge status={version.status} />
      </div>

      <section className="mt-6">
        <h3 className="font-semibold">技能定义</h3>
        <dl className="mt-3 grid gap-3 rounded-lg bg-[var(--aios-canvas)] p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-[var(--aios-muted)]">用途</dt><dd className="mt-1">{version.skillDefinition.purpose}</dd></div>
          <div><dt className="text-xs text-[var(--aios-muted)]">任务类型 / 风险</dt><dd className="mt-1">{version.skillDefinition.taskTypes.map((type) => taskTypeLabels[type]).join("、")} · {version.skillDefinition.riskClassification}</dd></div>
          <div><dt className="text-xs text-[var(--aios-muted)]">输入</dt><dd className="mt-1">{version.skillDefinition.inputContract}</dd></div>
          <div><dt className="text-xs text-[var(--aios-muted)]">输出</dt><dd className="mt-1">{version.skillDefinition.outputContract}</dd></div>
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="font-semibold">固定组件引用</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <RefCard label="提示词模板引用" objectId={version.promptTemplateRef.promptId} versionId={version.promptTemplateRef.versionId} digest={version.promptTemplateRef.digest} />
          <RefCard label="工作流版本引用" objectId={version.workflowVersionRef.workflowId} versionId={version.workflowVersionRef.versionId} digest={version.workflowVersionRef.digest} />
          <div className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">模型策略</p>
            <p className="mt-2 font-semibold">{version.modelPolicy.profile}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--aios-muted)]">组织数据策略 · 结构化输出 · {version.modelPolicy.fallbackAllowed ? "受控降级处理" : "无降级处理"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold"><BrainCircuit size={18} aria-hidden="true" />知识库要求</h3>
          {version.knowledgeRequirements.length ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--aios-muted)]">{version.knowledgeRequirements.map((requirement, index) => <li key={index}>当前工作空间 · 内部及以下 · 引用{requirement.citationRequired ? "必需" : "可选"}</li>)}</ul>
          ) : <p className="mt-3 text-sm text-[var(--aios-muted)]">没有知识依赖。</p>}
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold"><Wrench size={18} aria-hidden="true" />工具要求</h3>
          {version.toolRequirements.length ? (
            <ul className="mt-3 space-y-2 text-sm text-[var(--aios-muted)]">{version.toolRequirements.map((requirement) => <li key={requirement.action}><span className="font-mono">{requirement.action}</span> · {requirement.riskLevel} · {requirement.required ? "必需" : "可选"}</li>)}</ul>
          ) : <p className="mt-3 text-sm text-[var(--aios-muted)]">没有工具动作依赖。</p>}
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} aria-hidden="true" />权限要求</h3>
          <div className="mt-3 flex flex-wrap gap-2">{version.permissionRequirements.map((requirement) => <Badge key={`${requirement.resource}:${requirement.action}`} tone="neutral">{permissionResourceLabels[requirement.resource]}：{permissionActionLabels[requirement.action]}</Badge>)}</div>
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] p-4">
          <h3 className="flex items-center gap-2 font-semibold"><FileCheck2 size={18} aria-hidden="true" />成果契约</h3>
          <p className="mt-3 text-sm">{artifactTypeLabels[version.artifactContract.artifactType]} · 必须人工审核</p>
          <p className="mt-2 text-xs text-[var(--aios-muted)]">{version.artifactContract.completionCriteriaMapping.join("；")}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
          <h3 className="font-semibold">评测门禁</h3>
          <p className="mt-2 text-sm text-[var(--aios-muted)]">{version.evaluationGate.sampleSetVersion} · 最少运行 {version.evaluationGate.minimumRuns} 次 · 质量评分 ≥ {version.evaluationGate.qualityThreshold}</p>
          {evaluation ? (
            <div className="mt-3 rounded-lg bg-[var(--aios-surface)] p-3 text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 className="text-[var(--aios-success-foreground)]" size={17} aria-hidden="true" /><strong>{evaluationLabels[evaluation.result]}</strong> · 评分 {evaluation.qualityScore}</div>
              <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">{evaluation.evidenceReference}</p>
            </div>
          ) : <p className="mt-3 text-sm text-[var(--aios-muted)]">尚未执行评测。</p>}
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
          <h3 className="font-semibold">失败策略</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--aios-muted)]">
            <li>模型：有限重试后转人工处理</li>
            <li>权限：停止执行</li>
            <li>知识缺失：要求补充信息</li>
            <li>工具结果未知：转人工验收</li>
          </ul>
        </div>
      </section>
    </Card>
  );
}

export function CapabilityDetailScreen({
  item,
  permission,
  actionState,
  onAction,
  scopeLabels,
}: {
  item: Capability;
  permission: CapabilityPermissionDecision;
  actionState: CapabilityActionState;
  onAction: (action: CapabilityAction, versionId?: string, reason?: string) => Promise<void>;
  scopeLabels: { organizationName: string; workspaceName: string };
}) {
  const [selectedVersionId, setSelectedVersionId] = useState(
    item.publishedVersionId ?? item.versions.at(-1)!.id,
  );
  const selected =
    item.versions.find(({ id }) => id === selectedVersionId) ??
    item.versions.at(-1)!;
  const busy = actionState.status === "working";

  function suspend() {
    const reason = window.prompt("请输入暂停原因。新任务将无法解析此版本。");
    if (reason?.trim()) void onAction("SUSPEND", selected.id, reason.trim());
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <Link href="/capabilities" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]">
        <ArrowLeft size={16} aria-hidden="true" />返回能力中心
      </Link>
      <header className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--aios-primary)]">能力聚合</p>
          <h1 className="mt-1 text-3xl font-semibold">{item.name}</h1>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">{item.code} · {item.id}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">{item.purpose}</p>
          <p className="mt-2 text-xs text-[var(--aios-muted)]">{scopeLabels.organizationName} / {scopeLabels.workspaceName} · 负责人 {ownerNames[item.ownerId] ?? item.ownerId} · 聚合 v{item.aggregateVersion}</p>
        </div>
        {permission.canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void onAction("CREATE_VERSION")}><Plus size={17} aria-hidden="true" />创建新版本</Button>
            {selected.status === "DRAFT" ? <Button disabled={busy} onClick={() => void onAction("EVALUATE", selected.id)}><Activity size={17} aria-hidden="true" />运行模拟评测</Button> : null}
            {selected.status === "IN_REVIEW" ? <Button disabled={busy} onClick={() => void onAction("PUBLISH", selected.id)}><Send size={17} aria-hidden="true" />审核并发布</Button> : null}
            {selected.status === "PUBLISHED" ? <><Button variant="secondary" disabled={busy} onClick={suspend}><PauseCircle size={17} aria-hidden="true" />暂停</Button><Button variant="secondary" disabled={busy} onClick={() => void onAction("DEPRECATE", selected.id)}>已弃用</Button></> : null}
            {selected.status === "SUSPENDED" ? <Button disabled={busy} onClick={() => void onAction("RESUME", selected.id)}><PlayCircle size={17} aria-hidden="true" />复核并恢复</Button> : null}
          </div>
        ) : <p className="rounded-lg border border-[var(--aios-control-border)] px-4 py-3 text-sm text-[var(--aios-muted)]">{permission.reason}</p>}
      </header>

      {actionState.status === "working" ? (
        <Card role="status" aria-live="polite" className="mt-5 flex items-center gap-3 p-4"><Activity className="animate-pulse text-[var(--aios-primary)] motion-reduce:animate-none" size={18} aria-hidden="true" />正在执行 {actionState.action}，写入前会验证状态与权限…</Card>
      ) : actionState.status === "error" ? (
        <Card role="alert" className="mt-5 flex items-start gap-3 border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] p-4"><AlertCircle className="mt-0.5 text-[var(--aios-error-foreground)]" size={18} aria-hidden="true" /><p className="text-sm">{actionState.message}</p></Card>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <h2 className="flex items-center gap-2 font-semibold"><GitBranch size={18} aria-hidden="true" />版本历史</h2>
          <div className="mt-4 grid gap-2">
            {[...item.versions].sort((a, b) => b.versionNumber - a.versionNumber).map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => setSelectedVersionId(version.id)}
                className={`min-h-11 rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)] ${selected.id === version.id ? "border-[var(--aios-primary)] bg-[color-mix(in_srgb,var(--aios-primary)_7%,var(--aios-surface))]" : "border-[var(--aios-control-border)]"}`}
              >
                <span className="flex items-center justify-between gap-2"><strong>v{version.versionNumber}</strong><CapabilityStatusBadge status={version.status} /></span>
                <span className="mt-2 block break-all font-mono text-xs text-[var(--aios-muted)]">{version.id}</span>
              </button>
            ))}
          </div>
        </Card>
        <VersionDetail version={selected} />
      </section>

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Boxes size={18} aria-hidden="true" />使用情况与运行边界</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
          任务引用 {item.referencedTaskIds.length} 次。已发布只证明设计、评测和审核通过，不授予 AI 员工、用户、知识或工具权限；运行时仍按分配、任务类型、工作空间、权限与自主等级计算交集。
        </p>
        {item.referencedTaskIds.length ? <div className="mt-3 flex flex-wrap gap-2">{item.referencedTaskIds.map((taskId) => <Link className="rounded-full border border-[var(--aios-control-border)] px-3 py-1 text-xs font-semibold" href={`/tasks/${taskId}`} key={taskId}>{taskId}</Link>)}</div> : null}
      </Card>
    </div>
  );
}
