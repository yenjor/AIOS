"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Database,
  FileClock,
  FlaskConical,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  KNOWLEDGE_CLASSIFICATION_LABELS,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
} from "./knowledge-display";
import {
  KnowledgeEffectiveBadge,
  KnowledgeIndexBadge,
} from "./knowledge-status-badge";
import type {
  KnowledgeClassification,
  KnowledgeEffectiveStatus,
  KnowledgeIndexStatus,
  KnowledgeListItem,
  KnowledgePage,
  KnowledgePermissionDecision,
  KnowledgeQuery,
  KnowledgeSummary,
} from "./model";

const ownerNames: Record<string, string> = {
  "user-lead": "陈明",
  "user-admin": "吴桐",
  "user-pm": "林悦",
  "user-dev": "周航",
};

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Database;
}) {
  return (
    <Card role="group" aria-label={label} className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--aios-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <span
          className="grid size-10 place-items-center rounded-lg bg-[var(--aios-canvas)] text-[var(--aios-primary)]"
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

function KnowledgeLink({ item }: { item: KnowledgeListItem }) {
  return (
    <Link
      href={`/knowledge/${item.id}`}
      aria-label={`查看知识条目 ${item.id}`}
      className="font-semibold underline-offset-4 hover:text-[var(--aios-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
    >
      {item.title}
    </Link>
  );
}

function KnowledgeFacts({ item }: { item: KnowledgeListItem }) {
  return (
    <>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">双状态</dt>
        <dd className="mt-1 flex flex-wrap gap-2">
          <KnowledgeEffectiveBadge status={item.effectiveStatus} />
          <KnowledgeIndexBadge status={item.indexStatus} />
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">当前版本</dt>
        <dd className="mt-1 text-sm">
          v{item.currentVersionNumber} ·{" "}
          <span className="break-all font-mono text-xs">
            {item.currentVersionId}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">来源</dt>
        <dd className="mt-1 break-words text-sm">
          {KNOWLEDGE_SOURCE_TYPE_LABELS[item.sourceType]} · {item.sourceLocation}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">所有者</dt>
        <dd className="mt-1 text-sm">
          {ownerNames[item.ownerId] ?? item.ownerId}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">敏感等级</dt>
        <dd className="mt-1">
          <Badge
            tone={
              item.classification === "CONFIDENTIAL"
                ? "error"
                : item.classification === "INTERNAL"
                  ? "warning"
                  : "info"
            }
          >
            {KNOWLEDGE_CLASSIFICATION_LABELS[item.classification]}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--aios-muted)]">引用</dt>
        <dd className="mt-1 text-sm">
          任务 {item.referencedTaskCount} · 能力{" "}
          {item.referencedCapabilityCount}
        </dd>
      </div>
    </>
  );
}

export interface KnowledgeCenterScreenProps {
  scopeLabels: {
    organizationName: string;
    workspaceName: string;
  };
  permission: KnowledgePermissionDecision;
  summary: KnowledgeSummary;
  page: KnowledgePage;
  query: KnowledgeQuery;
  onQueryChange: (query: KnowledgeQuery) => void;
}

export function KnowledgeCenterScreen({
  scopeLabels,
  permission,
  summary,
  page,
  query,
  onQueryChange,
}: KnowledgeCenterScreenProps) {
  const [keyword, setKeyword] = useState(query.keyword ?? "");
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  function updateFilter<
    Key extends "effectiveStatus" | "indexStatus" | "classification",
  >(key: Key, value: KnowledgeQuery[Key] | undefined) {
    const next: KnowledgeQuery = { ...query, page: 1 };
    if (value) {
      Object.assign(next, { [key]: value });
    } else {
      delete next[key];
    }
    onQueryChange(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: KnowledgeQuery = { ...query, page: 1 };
    const normalized = keyword.trim();
    if (normalized) {
      next.keyword = normalized;
    } else {
      delete next.keyword;
    }
    onQueryChange(next);
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            工作空间知识库视图
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            知识库
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--aios-muted)]">
            <span className="flex items-center gap-2">
              <Building2 size={16} aria-hidden="true" />
              组织：{scopeLabels.organizationName}
            </span>
            <span className="flex items-center gap-2">
              <Database size={16} aria-hidden="true" />
              工作空间：{scopeLabels.workspaceName}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            管理知识条目、固定知识版本、来源、范围、敏感等级和处理证据。
            文档、分块、向量化与索引只作为可重建的处理投影展示。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/knowledge/retrieval"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-4 text-sm font-semibold hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
          >
            <FlaskConical size={17} aria-hidden="true" />
            检索测试
          </Link>
          {permission.canManage ? (
            <Link
              href="/knowledge/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-[var(--aios-surface)] hover:bg-[color-mix(in_srgb,var(--aios-primary)_85%,var(--aios-navigation))] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <Plus size={17} aria-hidden="true" />
              新增 / 导入知识
            </Link>
          ) : (
            <p className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-4 py-3 text-sm text-[var(--aios-muted)]">
              当前身份仅可查看和使用已授权的知识。
            </p>
          )}
        </div>
      </header>

      <section
        aria-label="知识库摘要"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard label="可见知识" value={summary.total} icon={Database} />
        <SummaryCard label="有效且就绪" value={summary.effective} icon={BookOpenCheck} />
        <SummaryCard label="草稿版本" value={summary.draft} icon={FileClock} />
        <SummaryCard label="需要处理" value={summary.attention} icon={AlertTriangle} />
      </section>

      <Card className="mt-5 p-4 sm:p-5">
        <form
          role="search"
          aria-label="知识库筛选"
          onSubmit={submitSearch}
          className="grid gap-4 xl:grid-cols-[minmax(230px,1.5fr)_repeat(3,minmax(150px,1fr))_auto]"
        >
          <label className="text-sm font-medium">
            <span>关键词</span>
            <span className="mt-2 flex min-w-0 items-center rounded-lg border border-[var(--aios-control-border)] focus-within:outline-2 focus-within:outline-[var(--aios-primary)]">
              <Search
                className="ml-3 shrink-0 text-[var(--aios-muted)]"
                size={17}
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="搜索知识库"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                placeholder="名称、编码或来源"
              />
            </span>
          </label>
          <label className="text-sm font-medium">
            <span>有效状态</span>
            <select
              aria-label="有效状态"
              value={query.effectiveStatus ?? ""}
              onChange={(event) =>
                updateFilter(
                  "effectiveStatus",
                  (event.target.value || undefined) as
                    | KnowledgeEffectiveStatus
                    | undefined,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="EFFECTIVE">有效</option>
              <option value="INVALIDATED">已失效</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            <span>索引状态</span>
            <select
              aria-label="索引状态"
              value={query.indexStatus ?? ""}
              onChange={(event) =>
                updateFilter(
                  "indexStatus",
                  (event.target.value || undefined) as
                    | KnowledgeIndexStatus
                    | undefined,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <option value="">全部索引状态</option>
              {["PENDING", "INDEXING", "READY", "FAILED", "STALE"].map(
                (status) => (
                  <option key={status} value={status}>
                    {{
                      PENDING: "等待索引",
                      INDEXING: "索引中",
                      READY: "索引就绪",
                      FAILED: "索引失败",
                      STALE: "索引过期",
                    }[status]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-sm font-medium">
            <span>敏感等级</span>
            <select
              aria-label="敏感等级"
              value={query.classification ?? ""}
              onChange={(event) =>
                updateFilter(
                  "classification",
                  (event.target.value || undefined) as
                    | KnowledgeClassification
                    | undefined,
                )
              }
              className="mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <option value="">全部敏感等级</option>
              <option value="PUBLIC">公开</option>
              <option value="INTERNAL">内部</option>
              <option value="CONFIDENTIAL">机密</option>
            </select>
          </label>
          <Button type="submit" className="self-end">
            搜索
          </Button>
        </form>
      </Card>

      <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm text-[var(--aios-muted)]">
        <p>共 {page.total} 个知识条目</p>
        <p>
          第 {page.page} / {totalPages} 页
        </p>
      </div>

      {page.items.length === 0 ? (
        <Card className="mt-4 p-8 text-center">
          <Database
            className="mx-auto text-[var(--aios-muted)]"
            size={28}
            aria-hidden="true"
          />
          <p className="mt-3 font-semibold">没有符合条件的知识条目</p>
          <p className="mt-1 text-sm text-[var(--aios-muted)]">
            调整关键词、双状态或敏感等级后重试。
          </p>
        </Card>
      ) : (
        <>
          <Card className="mt-4 hidden overflow-hidden lg:block">
            <div
              role="region"
              aria-label="知识库表格，可横向滚动"
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              <table
                aria-label="知识库列表"
                className="w-full min-w-[1320px] text-left text-sm"
              >
                <thead className="bg-[var(--aios-canvas)] text-[var(--aios-muted)]">
                  <tr>
                    {[
                      "知识条目",
                      "类型 / 来源",
                      "所有者",
                      "敏感等级",
                      "有效状态",
                      "索引状态",
                      "当前版本",
                      "任务 / 能力引用",
                      "纠错",
                      "更新时间",
                    ].map((heading) => (
                      <th key={heading} scope="col" className="px-4 py-3 font-medium">
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
                      <th scope="row" className="min-w-64 px-4 py-4">
                        <KnowledgeLink item={item} />
                        <span className="mt-1 block break-all font-mono text-xs font-normal text-[var(--aios-muted)]">
                          {item.id} · {item.code}
                        </span>
                      </th>
                      <td className="max-w-72 px-4 py-4">
                        <p>{KNOWLEDGE_SOURCE_TYPE_LABELS[item.sourceType]}</p>
                        <p className="mt-1 break-all text-xs text-[var(--aios-muted)]">
                          {item.sourceLocation}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {ownerNames[item.ownerId] ?? item.ownerId}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          tone={
                            item.classification === "CONFIDENTIAL"
                              ? "error"
                              : item.classification === "INTERNAL"
                                ? "warning"
                                : "info"
                          }
                        >
                          {KNOWLEDGE_CLASSIFICATION_LABELS[item.classification]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <KnowledgeEffectiveBadge status={item.effectiveStatus} />
                      </td>
                      <td className="px-4 py-4">
                        <KnowledgeIndexBadge status={item.indexStatus} />
                      </td>
                      <td className="px-4 py-4">
                        v{item.currentVersionNumber}
                        <span className="mt-1 block break-all font-mono text-xs text-[var(--aios-muted)]">
                          {item.currentVersionId}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        任务 {item.referencedTaskCount} · 能力{" "}
                        {item.referencedCapabilityCount}
                      </td>
                      <td className="px-4 py-4">
                        {item.openCorrectionCount > 0 ? (
                          <Badge tone="warning">
                            {item.openCorrectionCount} 个待处理
                          </Badge>
                        ) : (
                          "无"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <time className="break-all text-xs" dateTime={item.updatedAt}>
                          {item.updatedAt}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ul aria-label="知识库移动端列表" className="mt-4 space-y-3 lg:hidden">
            {page.items.map((item) => (
              <li key={item.id}>
                <Card className="p-4">
                  <KnowledgeLink item={item} />
                  <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                    {item.id} · {item.code}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <KnowledgeFacts item={item} />
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <nav
        aria-label="知识库分页"
        className="mt-5 flex flex-wrap justify-end gap-3"
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
