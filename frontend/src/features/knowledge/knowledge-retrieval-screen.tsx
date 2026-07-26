"use client";

import {
  AlertCircle,
  BookOpen,
  Braces,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  KnowledgeRepositoryError,
  retrieveKnowledge,
} from "./mock/knowledge-repository";
import type { KnowledgeRetrievalResponse } from "./model";

type RetrievalState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; response: KnowledgeRetrievalResponse }
  | { status: "error"; message: string };

export function KnowledgeRetrievalScreen() {
  const { hydrated, organization, user, workspace } = useSession();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<RetrievalState>({ status: "idle" });
  const complete = Boolean(hydrated && organization && user && workspace);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !user || !workspace || !query.trim()) {
      return;
    }
    setState({ status: "loading" });
    try {
      const response = await retrieveKnowledge(
        {
          organizationId: organization.id,
          workspaceId: workspace.id,
        },
        { userId: user.id },
        query,
      );
      setState({ status: "ready", response });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof KnowledgeRepositoryError
            ? error.message
            : "Knowledge Retrieval 执行失败。",
      });
    }
  }

  if (!complete || !organization || !user || !workspace) {
    return null;
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Permission-before-Relevance
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Knowledge Retrieval
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            在当前 Organization、Workspace、身份和用途范围内检索有效且索引就绪的
            KnowledgeVersion，并返回可追溯 Citation。
          </p>
        </div>
        <Link
          href="/knowledge"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
        >
          返回 Knowledge Center
        </Link>
      </header>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
          <Sparkles
            className="mt-0.5 shrink-0 text-[var(--aios-primary)]"
            size={20}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold">
              Deterministic Mock Hybrid Retrieval
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
              MVP 用可复现的词法评分模拟 Sparse + Dense
              合并；没有调用外部模型、Qdrant 或真实 Embedding。权限、固定版本与
              Citation 边界按正式流程执行。
            </p>
          </div>
        </div>

        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => void submit(event)}
        >
          <label className="sr-only" htmlFor="knowledge-retrieval-query">
            检索问题
          </label>
          <input
            required
            id="knowledge-retrieval-query"
            className="min-h-11 flex-1 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            maxLength={300}
            placeholder="例如：AIOS Task 如何绑定固定 KnowledgeVersion？"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            type="submit"
            disabled={state.status === "loading" || !query.trim()}
          >
            <Search size={18} aria-hidden="true" />
            {state.status === "loading" ? "正在检索…" : "执行检索"}
          </Button>
        </form>
      </Card>

      {state.status === "error" ? (
        <Card role="alert" className="mt-5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 text-[var(--aios-error-foreground)]"
              size={20}
              aria-hidden="true"
            />
            <p className="text-sm">{state.message}</p>
          </div>
        </Card>
      ) : null}

      {state.status === "ready" ? (
        <section className="mt-7" aria-labelledby="retrieval-results-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="retrieval-results-title" className="text-xl font-semibold">
                检索结果
              </h2>
              <p className="mt-1 text-sm text-[var(--aios-muted)]">
                {state.response.results.length} 个已授权固定版本
              </p>
            </div>
            <Badge tone="info">{state.response.retrievalMode}</Badge>
          </div>

          {state.response.outcome === "EMPTY" ? (
            <Card className="mt-4 p-8 text-center">
              <BookOpen
                className="mx-auto text-[var(--aios-muted)]"
                size={28}
                aria-hidden="true"
              />
              <p className="mt-3 font-semibold">没有可返回的授权结果</p>
              <p className="mt-1 text-sm text-[var(--aios-muted)]">
                结果可能不存在、未发布、索引未就绪或不在当前身份的可见范围。
              </p>
            </Card>
          ) : (
            <ol className="mt-4 space-y-4">
              {state.response.results.map((result) => (
                <li key={`${result.knowledgeId}-${result.versionId}`}>
                  <Card className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={`/knowledge/${result.knowledgeId}`}
                          className="text-lg font-semibold underline-offset-4 hover:text-[var(--aios-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
                        >
                          {result.knowledgeTitle}
                        </Link>
                        <p className="mt-2 break-all font-mono text-xs text-[var(--aios-muted)]">
                          {result.knowledgeId} · v{result.versionNumber} ·{" "}
                          {result.versionId}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="success">
                          Score {result.score.toFixed(3)}
                        </Badge>
                        <Badge>Sparse {result.sparseScore.toFixed(3)}</Badge>
                        <Badge>Dense {result.denseScore.toFixed(3)}</Badge>
                      </div>
                    </div>
                    <blockquote className="mt-4 border-l-4 border-[var(--aios-primary)] pl-4 text-sm leading-6 text-[var(--aios-muted)]">
                      {result.excerpt}
                    </blockquote>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold">
                          <ShieldCheck size={15} aria-hidden="true" />
                          KnowledgeVersionId
                        </p>
                        <p className="mt-2 break-all font-mono text-xs">
                          {result.citation.knowledgeVersionId}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold">
                          <BookOpen size={15} aria-hidden="true" />
                          Content Location
                        </p>
                        <p className="mt-2 break-all font-mono text-xs">
                          {result.citation.contentLocation}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[var(--aios-canvas)] p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold">
                          <Braces size={15} aria-hidden="true" />
                          Citation Digest
                        </p>
                        <p className="mt-2 break-all font-mono text-xs">
                          {result.citation.citationDigest}
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}

          <Card className="mt-5 p-4">
            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--aios-muted)]">
                  Permission Digest
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {state.response.permissionDigest}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--aios-muted)]">
                  Scope Digest
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {state.response.scopeDigest}
                </dd>
              </div>
            </dl>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
