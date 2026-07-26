"use client";

import {
  Bot,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Network,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DeepReadonly, WorkspaceRole } from "@/types/domain";

import type { TechnicalSolutionArtifact } from "./model";

export interface ArtifactDetailScreenProps {
  artifact: DeepReadonly<TechnicalSolutionArtifact>;
  scopeLabels: {
    organizationName: string;
    workspaceName: string;
  };
  viewer: {
    name: string;
    role: WorkspaceRole;
  };
}

function VersionList({
  label,
  values,
}: {
  label: string;
  values: readonly string[];
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
      <dt className="text-xs font-medium text-[var(--aios-muted)]">{label}</dt>
      <dd className="mt-2 space-y-1">
        {values.map((value) => (
          <span key={value} className="block break-all font-mono text-xs">
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}

export function ArtifactDetailScreen({
  artifact,
  scopeLabels,
  viewer,
}: ArtifactDetailScreenProps) {
  return (
    <article className="mx-auto max-w-[1400px]">
      <header className="rounded-[10px] border border-[color-mix(in_srgb,var(--aios-muted)_25%,var(--aios-surface))] bg-[var(--aios-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={artifact.status === "ACCEPTED" ? "success" : "warning"}>
                {artifact.status}
              </Badge>
              <Badge tone="info">{artifact.artifactType}</Badge>
              <Badge>Version {artifact.version.versionNumber}</Badge>
            </div>
            <p className="mt-4 break-all font-mono text-xs text-[var(--aios-muted)]">
              {artifact.id}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {artifact.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
              独立 Artifact Read Model；正文、来源、校验和人工验收状态均来自持久化版本。
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] px-4 py-3 text-sm">
            <p className="font-semibold">
              {viewer.name}（{viewer.role}）
            </p>
            <p className="mt-1 text-xs text-[var(--aios-muted)]">
              Artifact 页面只读；验收动作在所属 Task 上执行。
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">Organization</dt>
            <dd className="mt-1 text-sm font-semibold">
              {scopeLabels.organizationName}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">Workspace</dt>
            <dd className="mt-1 text-sm font-semibold">
              {scopeLabels.workspaceName}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">VersionRef</dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {artifact.version.versionId}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
            <dt className="text-xs text-[var(--aios-muted)]">Digest</dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {artifact.version.digest}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-7 grid gap-7">
        <section aria-labelledby="artifact-provenance-title">
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint
              size={20}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h2 id="artifact-provenance-title" className="text-xl font-semibold">
              Provenance
            </h2>
          </div>
          <Card className="p-5">
            <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <VersionList
                label="AgentVersion"
                values={[artifact.provenance.agentVersionId]}
              />
              <VersionList
                label="CapabilityVersion"
                values={artifact.provenance.capabilityVersionIds}
              />
              <VersionList
                label="KnowledgeVersion"
                values={artifact.provenance.knowledgeVersionIds}
              />
              <VersionList
                label="WorkflowVersion"
                values={[artifact.provenance.workflowVersionId]}
              />
              <VersionList
                label="ToolVersion"
                values={artifact.provenance.toolVersionIds}
              />
              <VersionList
                label="ExecutionRun"
                values={[artifact.provenance.runId]}
              />
            </dl>
            <p className="mt-4 break-all font-mono text-xs text-[var(--aios-muted)]">
              Content Digest：{artifact.provenance.contentDigest}
            </p>
          </Card>
        </section>

        <section aria-labelledby="artifact-content-title">
          <div className="mb-3 flex items-center gap-2">
            <FileCheck2
              size={20}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h2 id="artifact-content-title" className="text-xl font-semibold">
              技术方案正文
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {artifact.sections.map((section) => (
              <Card key={section.title} className="p-5">
                <h3 className="font-semibold">{section.title}</h3>
                <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--aios-muted)]">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="artifact-validation-title"
          className="grid gap-5 xl:grid-cols-2"
        >
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={20}
                className="text-[var(--aios-primary)]"
                aria-hidden="true"
              />
              <h2 id="artifact-validation-title" className="text-xl font-semibold">
                Validation
              </h2>
            </div>
            <ul className="mt-4 space-y-3">
              {artifact.validationResults.map((result) => (
                <li
                  key={result.id}
                  className="rounded-lg bg-[var(--aios-canvas)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{result.name}</span>
                    <Badge
                      tone={result.status === "PASSED" ? "success" : "warning"}
                    >
                      {result.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--aios-muted)]">
                    {result.summary}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Network
                size={20}
                className="text-[var(--aios-primary)]"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold">Knowledge Citation</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {artifact.citations.map((citation) => (
                <li
                  key={`${citation.knowledgeVersionId}-${citation.locator}`}
                  className="rounded-lg bg-[var(--aios-canvas)] p-3 text-xs"
                >
                  <p className="break-all font-mono">
                    {citation.knowledgeVersionId}
                  </p>
                  <p className="mt-2 break-all font-mono text-[var(--aios-muted)]">
                    {citation.locator}
                  </p>
                  <p className="mt-2 break-all font-mono text-[var(--aios-muted)]">
                    {citation.digest}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {artifact.status === "ACCEPTED" ? (
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
                  size={21}
                  aria-hidden="true"
                />
              ) : (
                <Bot
                  className="mt-0.5 shrink-0 text-[var(--aios-warning-foreground)]"
                  size={21}
                  aria-hidden="true"
                />
              )}
              <div>
                <h2 className="font-semibold">
                  {artifact.status === "ACCEPTED"
                    ? "Artifact 已由 Reviewer 验收"
                    : "Artifact 等待 Reviewer 验收"}
                </h2>
                <p className="mt-1 text-sm text-[var(--aios-muted)]">
                  {artifact.acceptedByUserId
                    ? `Accepted by ${artifact.acceptedByUserId} · ${artifact.acceptedAt}`
                    : `Reviewers：${artifact.reviewerUserIds.join("、")}`}
                </p>
              </div>
            </div>
            <Link
              href={`/tasks/${artifact.provenance.taskId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            >
              返回所属 Task
            </Link>
          </div>
        </Card>
      </div>
    </article>
  );
}
