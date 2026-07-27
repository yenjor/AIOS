"use client";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Send,
  Server,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { McpAction, McpActionState } from "./mcp-detail-loader";
import type {
  McpServerRegistration,
  Tool,
  ToolPermissionDecision,
} from "./model";
import { ToolHealthBadge, ToolStatusBadge } from "./tool-status-badge";

export function McpDetailScreen({
  server,
  tool,
  permission,
  actionState,
  onAction,
}: {
  server: McpServerRegistration;
  tool: Tool;
  permission: ToolPermissionDecision;
  actionState: McpActionState;
  onAction: (action: McpAction, reason?: string) => Promise<void>;
}) {
  const version =
    tool.versions.find(({ id }) => id === tool.publishedVersionId) ??
    tool.versions.at(-1)!;
  const test = server.lastTestSummary;
  const busy = actionState.status === "working";

  function suspend() {
    const reason = window.prompt(
      "请输入暂停原因（至少 8 个字符）。暂停后 Agent 与新 Task 将无法解析该 Action。",
    );
    if (reason?.trim()) void onAction("SUSPEND", reason.trim());
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        href="/tools/mcp"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回 MCP 连接中心
      </Link>
      <header className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Registered MCP Server
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{server.displayName}</h1>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
            {server.serverIdentity} · {server.id}
          </p>
        </div>
        {permission.canManage ? (
          <div className="flex flex-wrap gap-2">
            {server.status === "DRAFT" || server.status === "TESTING" ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void onAction("TEST")}
              >
                <Activity size={17} aria-hidden="true" />
                运行连接测试
              </Button>
            ) : null}
            {server.status === "TESTING" ? (
              <Button disabled={busy} onClick={() => void onAction("PUBLISH")}>
                <Send size={17} aria-hidden="true" />
                审核并启用
              </Button>
            ) : null}
            {server.status === "ENABLED" ? (
              <Button variant="secondary" disabled={busy} onClick={suspend}>
                <PauseCircle size={17} aria-hidden="true" />
                暂停连接
              </Button>
            ) : null}
            {server.status === "SUSPENDED" ? (
              <Button disabled={busy} onClick={() => void onAction("RESUME")}>
                <PlayCircle size={17} aria-hidden="true" />
                复核并恢复
              </Button>
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
          正在执行 {actionState.action}，写入前会验证状态、Health 与测试证据…
        </Card>
      ) : actionState.status === "error" ? (
        <Card role="alert" className="mt-5 flex items-start gap-3 p-4">
          <AlertCircle
            className="mt-0.5 text-[var(--aios-error-foreground)]"
            size={18}
            aria-hidden="true"
          />
          <p className="text-sm">{actionState.message}</p>
        </Card>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Server size={18} aria-hidden="true" />
              Server Registration
            </h2>
            <div className="flex gap-2">
              <ToolStatusBadge status={server.status} />
              <ToolHealthBadge status={server.healthStatus} />
            </div>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                Publisher / Version
              </dt>
              <dd className="mt-1">
                {server.publisher} · {server.serverVersion}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Transport</dt>
              <dd className="mt-1">
                <Badge tone="info">{server.transport}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                Endpoint Reference
              </dt>
              <dd className="mt-1 break-all font-mono">
                {server.endpointReference}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Compatibility</dt>
              <dd className="mt-1">{server.compatibility}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                Discovery Snapshot Digest
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {server.discoverySnapshotDigest}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs text-[var(--aios-muted)]">
                <KeyRound size={14} aria-hidden="true" />
                CredentialReference
              </dt>
              <dd className="mt-1 break-all font-mono">
                {server.credentialReference ?? "不需要 Credential"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wrench size={18} aria-hidden="true" />
            Local ToolVersion
          </h2>
          <p className="mt-3 font-semibold">{tool.name}</p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
            {version.id}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ToolStatusBadge status={tool.status} />
            <ToolStatusBadge status={version.status} />
            <ToolHealthBadge status={version.healthStatus} />
          </div>
          <Link
            href={`/tools/${tool.id}`}
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--aios-primary)] underline-offset-4 hover:underline"
          >
            查看 Action Contract
          </Link>
        </Card>
      </section>

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <CheckCircle2 size={18} aria-hidden="true" />
          Connection Test Gate
        </h2>
        {test ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="success">{test.result}</Badge>
              <span className="break-all font-mono text-xs text-[var(--aios-muted)]">
                {test.evidenceReference}
              </span>
            </div>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Identity", test.identityVerified],
                ["Schema", test.schemaVerified],
                ["Permission Negative", test.permissionNegativePassed],
                ["Result Validation", test.resultValidationPassed],
                ["Secret Isolation", test.secretIsolationPassed],
              ].map(([label, passed]) => (
                <li
                  key={String(label)}
                  className="rounded-lg bg-[var(--aios-canvas)] p-3"
                >
                  <strong>{label}</strong>
                  <span className="mt-1 block text-[var(--aios-success-foreground)]">
                    {passed ? "PASSED" : "FAILED"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--aios-muted)]">
            尚未测试。Draft Connection 不可启用，也不会进入 Agent Builder。
          </p>
        )}
      </Card>

      <Card className="mt-5 flex items-start gap-3 p-4 text-sm leading-6 text-[var(--aios-muted)]">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
          size={18}
          aria-hidden="true"
        />
        <p>
          MCP Server 与返回结果均是不可信外部执行面。当前 Mock 测试验证身份、Schema、
          Permission 负向用例、结果边界与 Secret 隔离；真实 Runtime 还需执行 Sandbox、
          Timeout、DLP、Egress 和 Audit。
        </p>
      </Card>
    </div>
  );
}
