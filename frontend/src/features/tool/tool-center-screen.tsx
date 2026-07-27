"use client";

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Plug,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type {
  ToolListItem,
  ToolPermissionDecision,
  ToolSummary,
} from "./model";
import { ToolHealthBadge, ToolStatusBadge } from "./tool-status-badge";

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Wrench;
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

function ToolLink({ item }: { item: ToolListItem }) {
  return (
    <Link
      href={`/tools/${item.id}`}
      className="font-semibold underline-offset-4 hover:text-[var(--aios-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
    >
      {item.name}
    </Link>
  );
}

export function ToolCenterScreen({
  items,
  summary,
  permission,
  scopeLabels,
}: {
  items: ToolListItem[];
  summary: ToolSummary;
  permission: ToolPermissionDecision;
  scopeLabels: { organizationName: string; workspaceName: string };
}) {
  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            工具上下文
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            工具中心
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--aios-muted)]">
            <span className="flex items-center gap-2">
              <Building2 size={16} aria-hidden="true" />
              组织：{scopeLabels.organizationName}
            </span>
            <span className="flex items-center gap-2">
              <Wrench size={16} aria-hidden="true" />
              工作空间：{scopeLabels.workspaceName}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            管理工具、不可变工具版本、动作定义、动作级风险与健康状态。
            工具只返回标准化调用结果，不修改任务业务状态。
          </p>
        </div>
        <Link
          href="/tools/mcp"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
        >
          <Plug size={17} aria-hidden="true" />
          管理 MCP 连接
        </Link>
      </header>

      <section
        aria-label="工具中心摘要"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard label="可见工具" value={summary.total} icon={Wrench} />
        <SummaryCard
          label="已发布"
          value={summary.published}
          icon={CheckCircle2}
        />
        <SummaryCard label="健康" value={summary.healthy} icon={Activity} />
        <SummaryCard
          label="需要处理"
          value={summary.attention}
          icon={AlertTriangle}
        />
      </section>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--aios-muted)]">
          共 {items.length} 个工具聚合
        </p>
        <p className="text-sm text-[var(--aios-muted)]">{permission.reason}</p>
      </div>

      <Card className="mt-4 hidden overflow-hidden lg:block">
        <div
          role="region"
          aria-label="工具目录表格，可横向滚动"
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
        >
          <table
            aria-label="工具目录"
            className="w-full min-w-[1100px] text-left text-sm"
          >
            <thead className="bg-[var(--aios-canvas)] text-[var(--aios-muted)]">
              <tr>
                {[
                  "工具",
                  "状态",
                  "健康状态",
                  "固定版本",
                  "动作",
                  "最高风险",
                  "MCP 服务",
                  "负责人",
                ].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[color-mix(in_srgb,var(--aios-muted)_18%,var(--aios-surface))] align-top"
                >
                  <th scope="row" className="max-w-96 px-4 py-4">
                    <ToolLink item={item} />
                    <span className="mt-1 block font-mono text-xs font-normal text-[var(--aios-muted)]">
                      {item.code} · {item.id}
                    </span>
                    <span className="mt-2 block text-xs font-normal leading-5 text-[var(--aios-muted)]">
                      {item.description}
                    </span>
                  </th>
                  <td className="px-4 py-4">
                    <ToolStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4">
                    <ToolHealthBadge status={item.healthStatus} />
                  </td>
                  <td className="px-4 py-4">
                    <span>v{item.currentVersionNumber}</span>
                    <span className="mt-1 block font-mono text-xs text-[var(--aios-muted)]">
                      {item.currentVersionId}
                    </span>
                  </td>
                  <td className="px-4 py-4">{item.actionCount}</td>
                  <td className="px-4 py-4">
                    <Badge tone={item.maxRiskLevel === "R0" ? "success" : "warning"}>
                      {item.maxRiskLevel}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">{item.connectionName}</td>
                  <td className="px-4 py-4">{item.ownerId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ul aria-label="工具目录移动端列表" className="mt-4 space-y-3 lg:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <Card className="p-4">
              <ToolLink item={item} />
              <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                {item.code} · {item.currentVersionId}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                {item.description}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">状态</dt>
                  <dd className="mt-1">
                    <ToolStatusBadge status={item.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">健康状态</dt>
                  <dd className="mt-1">
                    <ToolHealthBadge status={item.healthStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">动作</dt>
                  <dd className="mt-1">{item.actionCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">MCP</dt>
                  <dd className="mt-1">{item.connectionName}</dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-5 flex items-start gap-3 p-4 text-sm text-[var(--aios-muted)]">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
          size={18}
          aria-hidden="true"
        />
        <p>
          AI 员工与能力只能绑定已发布、健康状态为健康且位于当前工作空间的精确动作；发现、OAuth 范围或插件清单都不能自动产生业务权限。
        </p>
      </Card>
    </div>
  );
}
