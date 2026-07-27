"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { AgentStatusBadge } from "./agent-status-badge";
import type {
  AgentListItem,
  AgentPage,
  AgentPermissionDecision,
  AgentQuery,
  AgentStatus,
  AgentSummary,
  AutonomyLevel,
} from "./model";
import type { CapabilityTaskType } from "@/features/capability/model";

const ownerNames: Record<string, string> = {
  "user-lead": "陈明",
  "user-admin": "吴桐",
  "user-pm": "林悦",
  "user-dev": "周航",
};

const taskTypeLabels: Record<CapabilityTaskType, string> = {
  GENERATE_TECHNICAL_DESIGN: "生成技术方案",
  ANALYZE_REQUIREMENT: "分析需求",
  CODE_REVIEW: "代码审查",
  AUTOMATED_TEST: "自动测试",
};

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Bot;
}) {
  return (
    <Card className="p-4" role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--aios-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-lg bg-[var(--aios-canvas)] text-[var(--aios-primary)]"
        >
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

function AgentLink({ item }: { item: AgentListItem }) {
  return (
    <Link
      href={`/agents/${item.id}`}
      className="font-semibold underline-offset-4 hover:text-[var(--aios-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
    >
      {item.name}
    </Link>
  );
}

function MobileFacts({ item }: { item: AgentListItem }) {
  return (
    <>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">状态</dt>
        <dd className="mt-1">
          <AgentStatusBadge status={item.status} />
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">Human Owner</dt>
        <dd className="mt-1 text-sm">
          {ownerNames[item.humanOwnerId] ?? item.humanOwnerId}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">固定版本</dt>
        <dd className="mt-1 break-all font-mono text-xs">
          v{item.currentVersionNumber} · {item.currentVersionId}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">自治级别</dt>
        <dd className="mt-1 text-sm">{item.autonomyLevel}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">Capability</dt>
        <dd className="mt-1 text-sm">{item.capabilityCount} 个固定版本</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">Task 使用</dt>
        <dd className="mt-1 text-sm">{item.taskUsageCount}</dd>
      </div>
    </>
  );
}

export function AgentCenterScreen({
  scopeLabels,
  permission,
  summary,
  page,
  query,
  onQueryChange,
}: {
  scopeLabels: { organizationName: string; workspaceName: string };
  permission: AgentPermissionDecision;
  summary: AgentSummary;
  page: AgentPage;
  query: AgentQuery;
  onQueryChange: (query: AgentQuery) => void;
}) {
  const [keyword, setKeyword] = useState(query.keyword ?? "");
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = { ...query, page: 1 };
    if (keyword.trim()) next.keyword = keyword.trim();
    else delete next.keyword;
    onQueryChange(next);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Workspace AI Workforce Registry
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            AI 员工中心
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--aios-muted)]">
            <span className="flex items-center gap-2">
              <Building2 size={16} aria-hidden="true" />
              Organization：{scopeLabels.organizationName}
            </span>
            <span className="flex items-center gap-2">
              <Bot size={16} aria-hidden="true" />
              Workspace：{scopeLabels.workspaceName}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            管理 Agent 身份、不可变 AgentVersion、Human Owner、Capability
            Assignment、知识范围、Tool Grant 与自治级别。只有 Enabled Agent
            的 Published 版本可被新 Task 选择。
          </p>
        </div>
        {permission.canManage ? (
          <Link
            href="/agents/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-[var(--aios-surface)] hover:bg-[color-mix(in_srgb,var(--aios-primary)_85%,var(--aios-navigation))] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
          >
            <Plus size={17} aria-hidden="true" />
            创建 AI 员工
          </Link>
        ) : (
          <p className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-4 py-3 text-sm text-[var(--aios-muted)]">
            {permission.reason}
          </p>
        )}
      </header>

      <section
        aria-label="AI 员工中心摘要"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard label="可见 AI 员工" value={summary.total} icon={Bot} />
        <SummaryCard
          label="已启用"
          value={summary.enabled}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="测试中"
          value={summary.testing}
          icon={Activity}
        />
        <SummaryCard
          label="需要处理"
          value={summary.attention}
          icon={AlertTriangle}
        />
      </section>

      <Card className="mt-5 p-4 sm:p-5">
        <form
          role="search"
          aria-label="AI 员工目录筛选"
          className="grid gap-4 xl:grid-cols-[minmax(230px,1.5fr)_repeat(3,minmax(170px,1fr))_auto]"
          onSubmit={submitSearch}
        >
          <label className="text-sm font-medium">
            <span>关键词</span>
            <span className="mt-2 flex min-w-0 items-center rounded-lg border border-[var(--aios-control-border)] focus-within:outline-2 focus-within:outline-[var(--aios-primary)]">
              <Search
                className="ml-3 text-[var(--aios-muted)]"
                size={17}
                aria-hidden="true"
              />
              <input
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                placeholder="名称、Code 或职责"
              />
            </span>
          </label>
          <label className="text-sm font-medium">
            <span>Agent Status</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3"
              value={query.status ?? ""}
              onChange={(event) => {
                const next = { ...query, page: 1 };
                if (event.target.value)
                  next.status = event.target.value as AgentStatus;
                else delete next.status;
                onQueryChange(next);
              }}
            >
              <option value="">全部状态</option>
              {["DRAFT", "TESTING", "ENABLED", "SUSPENDED", "DISABLED"].map(
                (status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-sm font-medium">
            <span>AutonomyLevel</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3"
              value={query.autonomyLevel ?? ""}
              onChange={(event) => {
                const next = { ...query, page: 1 };
                if (event.target.value)
                  next.autonomyLevel = event.target.value as AutonomyLevel;
                else delete next.autonomyLevel;
                onQueryChange(next);
              }}
            >
              <option value="">全部级别</option>
              {["L0建议", "L1辅助", "L2受控执行"].map((level) => (
                <option value={level} key={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            <span>TaskType</span>
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3"
              value={query.taskType ?? ""}
              onChange={(event) => {
                const next = { ...query, page: 1 };
                if (event.target.value)
                  next.taskType = event.target.value as CapabilityTaskType;
                else delete next.taskType;
                onQueryChange(next);
              }}
            >
              <option value="">全部 TaskType</option>
              {Object.entries(taskTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="self-end">
            搜索
          </Button>
        </form>
      </Card>

      <div className="mt-5 flex justify-between gap-3 text-sm text-[var(--aios-muted)]">
        <p>共 {page.total} 个 AI 员工</p>
        <p>
          第 {page.page} / {totalPages} 页
        </p>
      </div>

      {page.items.length === 0 ? (
        <Card className="mt-4 p-8 text-center">
          <Bot
            className="mx-auto text-[var(--aios-muted)]"
            size={28}
            aria-hidden="true"
          />
          <p className="mt-3 font-semibold">没有符合条件的 AI 员工</p>
          <p className="mt-1 text-sm text-[var(--aios-muted)]">
            调整状态、自治级别、TaskType 或关键词后重试。
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-4 hidden overflow-hidden lg:block">
            <div
              role="region"
              aria-label="AI 员工目录表格，可横向滚动"
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <table
                aria-label="AI 员工目录"
                className="w-full min-w-[1180px] text-left text-sm"
              >
                <thead className="bg-[var(--aios-canvas)] text-[var(--aios-muted)]">
                  <tr>
                    {[
                      "AI 员工",
                      "Human Owner",
                      "状态",
                      "固定版本",
                      "Autonomy",
                      "TaskType",
                      "Capability",
                      "测试",
                      "Task 使用",
                    ].map((heading) => (
                      <th
                        scope="col"
                        key={heading}
                        className="px-4 py-3 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[color-mix(in_srgb,var(--aios-muted)_18%,var(--aios-surface))] align-top"
                    >
                      <th scope="row" className="max-w-80 px-4 py-4">
                        <AgentLink item={item} />
                        <span className="mt-1 block break-all font-mono text-xs font-normal text-[var(--aios-muted)]">
                          {item.code} · {item.id}
                        </span>
                        <span className="mt-2 block text-xs font-normal leading-5 text-[var(--aios-muted)]">
                          {item.roleDescription}
                        </span>
                      </th>
                      <td className="px-4 py-4">
                        {ownerNames[item.humanOwnerId] ?? item.humanOwnerId}
                      </td>
                      <td className="px-4 py-4">
                        <AgentStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="block">v{item.currentVersionNumber}</span>
                        <span className="mt-1 block break-all font-mono text-xs text-[var(--aios-muted)]">
                          {item.currentVersionId}
                        </span>
                      </td>
                      <td className="px-4 py-4">{item.autonomyLevel}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {item.taskTypes.map((type) => (
                            <Badge key={type} tone="info">
                              {taskTypeLabels[type]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">{item.capabilityCount}</td>
                      <td className="px-4 py-4">
                        {item.testResult ? (
                          <Badge tone="success">{item.testResult}</Badge>
                        ) : (
                          "未执行"
                        )}
                      </td>
                      <td className="px-4 py-4">{item.taskUsageCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <ul
            aria-label="AI 员工目录移动端列表"
            className="mt-4 space-y-3 lg:hidden"
          >
            {page.items.map((item) => (
              <li key={item.id}>
                <Card className="p-4">
                  <AgentLink item={item} />
                  <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                    {item.code} · {item.id}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                    {item.roleDescription}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <MobileFacts item={item} />
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-[var(--aios-muted)]">
          <UserRoundCheck
            className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
            size={17}
            aria-hidden="true"
          />
          Human Owner 是强制治理关系；AgentVersion 发布不等于获得 Task、知识或
          Tool 权限。
        </p>
        <nav aria-label="AI 员工目录分页" className="flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={page.page <= 1}
            onClick={() =>
              onQueryChange({ ...query, page: page.page - 1 })
            }
          >
            <ArrowLeft size={16} aria-hidden="true" />
            上一页
          </Button>
          <Button
            variant="secondary"
            disabled={page.page >= totalPages}
            onClick={() =>
              onQueryChange({ ...query, page: page.page + 1 })
            }
          >
            下一页
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </nav>
      </div>

      <Card className="mt-4 flex items-start gap-3 p-4 text-sm text-[var(--aios-muted)]">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-[var(--aios-primary)]"
          size={17}
          aria-hidden="true"
        />
        当前 Runtime 已开放受控的 CodeGraph MCP 只读 Tool Invocation；领域状态、权限边界与版本引用仍由本地持久化实现，不保存真实模型凭据，也不执行写入型 Tool。
      </Card>
    </div>
  );
}
