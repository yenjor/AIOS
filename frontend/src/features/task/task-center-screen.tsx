"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardCheck,
  ListTodo,
  PlayCircle,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type {
  TaskListItem,
  TaskOwnershipFilter,
  TaskPage,
  TaskQuery,
} from "./model";
import {
  RISK_LEVELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TEMPLATE_NAMES,
  type RiskLevel,
  type TaskStatus,
  type TaskTemplateName,
} from "./task-status";
import { TaskStatusBadge } from "./task-status-badge";

const USER_NAMES: Readonly<Record<string, string>> = {
  "user-pm": "林悦",
  "user-dev": "周航",
  "user-lead": "陈明",
  "user-admin": "吴桐",
  "user-auditor": "赵岚",
};

const OWNERSHIP_OPTIONS: readonly {
  value: TaskOwnershipFilter;
  label: string;
}[] = [
  { value: "all", label: "全部 Task" },
  { value: "mine", label: "我的任务" },
  { value: "participating", label: "我参与的" },
  { value: "pendingApproval", label: "待我审批" },
  { value: "pendingReview", label: "待我验收" },
];

export interface TaskCenterSummaries {
  mine: number;
  pendingApproval: number;
  executing: number;
  pendingReview: number;
}

export interface TaskCenterScreenProps {
  scopeLabels: {
    organizationName: string;
    workspaceName: string;
  };
  canCreate: boolean;
  summaries: TaskCenterSummaries;
  page: TaskPage;
  query: TaskQuery;
  onQueryChange: (query: TaskQuery) => void;
}

function userName(userId: string): string {
  return USER_NAMES[userId] ?? userId;
}

function normalizeAgentName(name?: string): string {
  return name?.replace("AI研发员工", "AI 研发员工") ?? "尚未分配";
}

function TaskLink({ task }: { task: TaskListItem }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      aria-label={`查看 Task ${task.id}`}
      className="break-words font-semibold text-[var(--aios-text)] underline-offset-4 hover:text-[var(--aios-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
    >
      {task.title}
    </Link>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ListTodo;
}) {
  return (
    <Card role="group" aria-label={label} className="min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--aios-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--aios-canvas)] text-[var(--aios-primary)]"
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

function TaskFacts({ task }: { task: TaskListItem }) {
  return (
    <>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">模板</dt>
        <dd className="mt-1 text-sm">{task.templateName}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">状态</dt>
        <dd className="mt-1">
          <TaskStatusBadge status={task.status} />
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">优先级 / 风险</dt>
        <dd className="mt-1 flex flex-wrap gap-2">
          <Badge tone="info">P{task.priority}</Badge>
          <Badge tone={task.riskLevel === "R0" ? "success" : "warning"}>
            {task.riskLevel}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">发起人</dt>
        <dd className="mt-1 break-words text-sm">
          {userName(task.initiator.userId)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">AI 员工</dt>
        <dd className="mt-1 break-words text-sm">
          {normalizeAgentName(task.assignedAgentName)}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">当前负责人</dt>
        <dd className="mt-1 break-words text-sm">
          {task.currentOwner?.displayName ?? "尚未产生"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">预期 Artifact</dt>
        <dd className="mt-1 break-words text-sm">
          {task.expectedArtifactType}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">更新时间</dt>
        <dd className="mt-1 break-all text-xs">
          <time dateTime={task.updatedAt}>{task.updatedAt}</time>
        </dd>
      </div>
    </>
  );
}

export function TaskCenterScreen({
  scopeLabels,
  canCreate,
  summaries,
  page,
  query,
  onQueryChange,
}: TaskCenterScreenProps) {
  const [keyword, setKeyword] = useState(query.keyword ?? "");
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  function updateFilter<
    Key extends "status" | "template" | "risk" | "ownership",
  >(key: Key, value: TaskQuery[Key] | undefined) {
    const nextQuery: TaskQuery = { ...query, page: 1 };
    if (value === undefined) {
      delete nextQuery[key];
    } else {
      Object.assign(nextQuery, { [key]: value });
    }
    if (key === "ownership" && value === undefined) {
      nextQuery.ownership = "all";
    }
    onQueryChange(nextQuery);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = keyword.trim();
    const nextQuery: TaskQuery = { ...query, page: 1 };
    if (nextKeyword) {
      nextQuery.keyword = nextKeyword;
    } else {
      delete nextQuery.keyword;
    }
    onQueryChange(nextQuery);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Workspace Task Read Model
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Task Center
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--aios-muted)]">
            <span className="flex min-w-0 items-center gap-2">
              <Building2 size={16} aria-hidden="true" />
              <span className="break-words">
                Organization：{scopeLabels.organizationName}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <ListTodo size={16} aria-hidden="true" />
              <span className="break-words">
                Workspace：{scopeLabels.workspaceName}
              </span>
            </span>
          </div>
        </div>
        {canCreate ? (
          <Link
            href="/tasks/new"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-[var(--aios-surface)] transition hover:bg-[color-mix(in_srgb,var(--aios-primary)_85%,var(--aios-navigation))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aios-primary)]"
          >
            <Plus size={17} aria-hidden="true" />
            创建 Task
          </Link>
        ) : (
          <p className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-4 py-3 text-sm text-[var(--aios-muted)]">
            当前身份可查看 Task，但不能创建。
          </p>
        )}
      </header>

      <section
        aria-label="Task 摘要"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard label="我的任务" value={summaries.mine} icon={ListTodo} />
        <SummaryCard
          label="待我审批"
          value={summaries.pendingApproval}
          icon={ClipboardCheck}
        />
        <SummaryCard
          label="执行中"
          value={summaries.executing}
          icon={PlayCircle}
        />
        <SummaryCard
          label="待我验收"
          value={summaries.pendingReview}
          icon={ClipboardCheck}
        />
      </section>

      <Card className="mt-5 p-4 sm:p-5">
        <form
          role="search"
          aria-label="Task 筛选"
          onSubmit={submitSearch}
          className="grid gap-4 xl:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(140px,1fr))_auto]"
        >
          <label className="min-w-0 text-sm font-medium">
            <span>关键词</span>
            <span className="mt-2 flex min-w-0 items-center rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] focus-within:outline-2 focus-within:outline-[var(--aios-primary)]">
              <Search
                className="ml-3 shrink-0 text-[var(--aios-muted)]"
                size={17}
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="搜索 Task"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                placeholder="标题或目标"
              />
            </span>
          </label>

          <label className="min-w-0 text-sm font-medium">
            <span>状态</span>
            <select
              aria-label="状态"
              value={
                typeof query.status === "string" ? query.status : ""
              }
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value
                    ? (event.target.value as TaskStatus)
                    : undefined,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <option value="">全部状态</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-medium">
            <span>模板</span>
            <select
              aria-label="模板"
              value={
                typeof query.template === "string" ? query.template : ""
              }
              onChange={(event) =>
                updateFilter(
                  "template",
                  event.target.value
                    ? (event.target.value as TaskTemplateName)
                    : undefined,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <option value="">全部模板</option>
              {TASK_TEMPLATE_NAMES.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-medium">
            <span>风险等级</span>
            <select
              aria-label="风险等级"
              value={typeof query.risk === "string" ? query.risk : ""}
              onChange={(event) =>
                updateFilter(
                  "risk",
                  event.target.value
                    ? (event.target.value as RiskLevel)
                    : undefined,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <option value="">全部风险</option>
              {RISK_LEVELS.map((risk) => (
                <option key={risk} value={risk}>
                  {risk}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-medium">
            <span>任务归属</span>
            <select
              aria-label="任务归属"
              value={query.ownership ?? "all"}
              onChange={(event) =>
                updateFilter(
                  "ownership",
                  event.target.value as TaskOwnershipFilter,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              {OWNERSHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" className="self-end">
            搜索
          </Button>
        </form>
      </Card>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--aios-muted)]">
          共 {page.total} 个 Task
        </p>
        <p className="text-sm text-[var(--aios-muted)]">
          第 {page.page} / {totalPages} 页
        </p>
      </div>

      {page.items.length === 0 ? (
        <Card className="mt-4 p-8 text-center">
          <ListTodo
            className="mx-auto text-[var(--aios-muted)]"
            size={28}
            aria-hidden="true"
          />
          <p className="mt-3 font-semibold">没有符合当前筛选条件的 Task</p>
          <p className="mt-1 text-sm text-[var(--aios-muted)]">
            可调整关键词、状态、模板、风险或任务归属。
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-4 hidden overflow-hidden lg:block">
            <div
              role="region"
              aria-label="Task 表格，可横向滚动"
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--aios-primary)]"
            >
              <table
                aria-label="Task 列表"
                className="w-full min-w-[1320px] text-left text-sm"
              >
                <thead className="bg-[var(--aios-canvas)] text-[var(--aios-muted)]">
                  <tr>
                    {[
                      "Task",
                      "模板",
                      "状态",
                      "优先级",
                      "风险",
                      "发起人",
                      "AI 员工",
                      "当前负责人",
                      "预期 Artifact",
                      "更新时间",
                    ].map((heading) => (
                      <th key={heading} scope="col" className="px-4 py-3 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((task) => (
                    <tr
                      key={task.id}
                      className="border-t border-[color-mix(in_srgb,var(--aios-muted)_18%,var(--aios-surface))] align-top"
                    >
                      <th scope="row" className="min-w-64 px-4 py-4">
                        <TaskLink task={task} />
                        <span className="mt-1 block break-all font-mono text-xs font-normal text-[var(--aios-muted)]">
                          {task.id}
                        </span>
                      </th>
                      <td className="px-4 py-4">{task.templateName}</td>
                      <td className="px-4 py-4">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-4 tabular-nums">{task.priority}</td>
                      <td className="px-4 py-4">
                        <Badge
                          tone={task.riskLevel === "R0" ? "success" : "warning"}
                        >
                          {task.riskLevel}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {userName(task.initiator.userId)}
                      </td>
                      <td className="px-4 py-4">
                        {normalizeAgentName(task.assignedAgentName)}
                      </td>
                      <td className="px-4 py-4">
                        {task.currentOwner?.displayName ?? "尚未产生"}
                      </td>
                      <td className="px-4 py-4">
                        {task.expectedArtifactType}
                      </td>
                      <td className="px-4 py-4">
                        <time
                          className="break-all text-xs text-[var(--aios-muted)]"
                          dateTime={task.updatedAt}
                        >
                          {task.updatedAt}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ul aria-label="Task 移动端列表" className="mt-4 space-y-3 lg:hidden">
            {page.items.map((task) => (
              <li key={task.id}>
                <Card className="min-w-0 p-4">
                  <TaskLink task={task} />
                  <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                    {task.id}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <TaskFacts task={task} />
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <nav
        aria-label="Task 分页"
        className="mt-5 flex flex-wrap items-center justify-end gap-3"
      >
        <Button
          variant="secondary"
          disabled={page.page <= 1}
          onClick={() =>
            onQueryChange({ ...query, page: Math.max(1, page.page - 1) })
          }
        >
          <ArrowLeft size={16} aria-hidden="true" />
          上一页
        </Button>
        <Button
          variant="secondary"
          disabled={page.page >= totalPages}
          onClick={() =>
            onQueryChange({
              ...query,
              page: Math.min(totalPages, page.page + 1),
            })
          }
        >
          下一页
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
