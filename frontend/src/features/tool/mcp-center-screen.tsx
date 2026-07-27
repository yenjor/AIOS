import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Plus,
  Server,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type {
  McpServerRegistration,
  McpServerSummary,
  ToolPermissionDecision,
} from "./model";
import { ToolHealthBadge, ToolStatusBadge } from "./tool-status-badge";
import { MCP_TRANSPORT_LABELS } from "./tool-display";

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Server;
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

export function McpCenterScreen({
  servers,
  summary,
  permission,
  scopeLabels,
}: {
  servers: McpServerRegistration[];
  summary: McpServerSummary;
  permission: ToolPermissionDecision;
  scopeLabels: { organizationName: string; workspaceName: string };
}) {
  return (
    <div className="mx-auto max-w-[1500px]">
      <Link
        href="/tools"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回工具中心
      </Link>
      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            工具层 / MCP 适配器
          </p>
          <h1 className="mt-1 text-3xl font-semibold">MCP 连接中心</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--aios-muted)]">
            <span className="flex items-center gap-2">
              <Building2 size={16} aria-hidden="true" />
              {scopeLabels.organizationName}
            </span>
            <span className="flex items-center gap-2">
              <Server size={16} aria-hidden="true" />
              {scopeLabels.workspaceName}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            注册和治理 MCP 服务身份、传输方式、端点引用、结构规范快照、健康状态与本地草稿工具版本。发现结果必须经过测试和人工发布。
          </p>
        </div>
        {permission.canManage ? (
          <Link
            href="/tools/mcp/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
          >
            <Plus size={17} aria-hidden="true" />
            注册 MCP 服务
          </Link>
        ) : (
          <p className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-4 py-3 text-sm text-[var(--aios-muted)]">
            {permission.reason}
          </p>
        )}
      </header>

      <section
        aria-label="MCP 连接摘要"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard label="已注册服务" value={summary.total} icon={Server} />
        <SummaryCard
          label="已启用"
          value={summary.enabled}
          icon={CheckCircle2}
        />
        <SummaryCard label="健康" value={summary.healthy} icon={Activity} />
        <SummaryCard
          label="需要处理"
          value={summary.attention}
          icon={AlertTriangle}
        />
      </section>

      <ul aria-label="MCP 服务列表" className="mt-5 grid gap-4 xl:grid-cols-2">
        {servers.map((server) => (
          <li key={server.id}>
            <Card className="h-full p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/tools/mcp/${server.id}`}
                    className="text-lg font-semibold underline-offset-4 hover:text-[var(--aios-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
                  >
                    {server.displayName}
                  </Link>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
                    {server.serverIdentity} · {server.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ToolStatusBadge status={server.status} />
                  <ToolHealthBadge status={server.healthStatus} />
                </div>
              </div>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">
                    发布者 / 版本
                  </dt>
                  <dd className="mt-1">
                    {server.publisher} · {server.serverVersion}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">传输方式</dt>
                  <dd className="mt-1">
                    <Badge tone="info">{MCP_TRANSPORT_LABELS[server.transport]}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">
                    端点引用
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {server.endpointReference}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">本地工具</dt>
                  <dd className="mt-1">
                    <Link
                      href={`/tools/${server.toolId}`}
                      className="font-mono text-xs text-[var(--aios-primary)] underline-offset-4 hover:underline"
                    >
                      {server.toolId}
                    </Link>
                  </dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-5 flex items-start gap-3 p-4 text-sm leading-6 text-[var(--aios-muted)]">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
          size={18}
          aria-hidden="true"
        />
        <p>
          MVP 仅开放受控 STDIO 和只读低风险动作。流式 HTTP、OAuth、远程出站访问与第三方自动安装仍保持关闭；凭据只保存密钥引用。
        </p>
      </Card>
    </div>
  );
}
