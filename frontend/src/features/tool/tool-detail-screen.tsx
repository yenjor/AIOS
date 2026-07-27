import {
  ArrowLeft,
  CheckCircle2,
  FileJson2,
  Plug,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import type { McpServerRegistration, Tool } from "./model";
import { ToolHealthBadge, ToolStatusBadge } from "./tool-status-badge";

export function ToolDetailScreen({
  tool,
  server,
}: {
  tool: Tool;
  server: McpServerRegistration;
}) {
  const version =
    tool.versions.find(({ id }) => id === tool.publishedVersionId) ??
    tool.versions.at(-1)!;
  const test = version.testSummaries.at(-1);

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        href="/tools"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回 Tool 中心
      </Link>

      <header className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Tool Aggregate
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{tool.name}</h1>
          <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
            {tool.code} · {tool.id}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            {tool.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolStatusBadge status={tool.status} />
          <ToolStatusBadge status={version.status} />
          <ToolHealthBadge status={version.healthStatus} />
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wrench size={18} aria-hidden="true" />
            ToolVersion v{version.versionNumber}
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Version ID</dt>
              <dd className="mt-1 break-all font-mono">{version.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Content Digest</dt>
              <dd className="mt-1 break-all font-mono">{version.contentDigest}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">PluginManifestRef</dt>
              <dd className="mt-1 break-all font-mono">
                {version.pluginManifestRef}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">
                CredentialReference
              </dt>
              <dd className="mt-1 break-all font-mono">
                {version.credentialReference ?? "不需要 Credential"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Plug size={18} aria-hidden="true" />
            MCP Server
          </h2>
          <p className="mt-3 font-semibold">{server.displayName}</p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
            {server.id} · {server.transport}
          </p>
          <Link
            href={`/tools/mcp/${server.id}`}
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--aios-primary)] underline-offset-4 hover:underline"
          >
            查看连接治理
          </Link>
        </Card>
      </section>

      <section className="mt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileJson2 size={19} aria-hidden="true" />
          ActionDefinition
        </h2>
        <div className="mt-3 grid gap-4">
          {version.actions.map((action) => (
            <Card key={action.name} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-mono font-semibold">{action.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                    {action.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="info">{action.operationType}</Badge>
                  <Badge tone={action.riskLevel === "R0" ? "success" : "warning"}>
                    {action.riskLevel}
                  </Badge>
                </div>
              </div>
              <dl className="mt-4 grid gap-4 rounded-lg bg-[var(--aios-canvas)] p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">Input Schema</dt>
                  <dd className="mt-1 break-all font-mono">{action.inputSchema}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">Output Schema</dt>
                  <dd className="mt-1 break-all font-mono">{action.outputSchema}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">Permission</dt>
                  <dd className="mt-1">{action.permissionRequirement}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--aios-muted)]">Digest</dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {action.definitionDigest}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <CheckCircle2
            className="text-[var(--aios-success-foreground)]"
            size={18}
            aria-hidden="true"
          />
          发布与测试证据
        </h2>
        {test ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Result</dt>
              <dd className="mt-1">
                <Badge tone="success">{test.result}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Evidence</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {test.evidenceReference}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--aios-muted)]">Tested At</dt>
              <dd className="mt-1">
                <time dateTime={test.testedAt}>{test.testedAt}</time>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-[var(--aios-muted)]">
            尚未形成通过发布门禁的连接测试证据。
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-[var(--aios-muted)]">
          <ShieldCheck
            className="mt-0.5 shrink-0"
            size={17}
            aria-hidden="true"
          />
          Published 仅表示固定 Contract 通过治理；每次调用仍需验证 Actor、Task、
          AgentVersion、CapabilityVersion、Action、Scope、Risk 与 ApprovalGrant。
        </p>
      </Card>
    </div>
  );
}
