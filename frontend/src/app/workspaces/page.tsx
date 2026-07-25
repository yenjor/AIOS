"use client";

import { ArrowLeft, ArrowRight, PanelsTopLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";
import { workspace } from "@/mock/fixtures";

export default function WorkspacesPage() {
  const router = useRouter();
  const { user, organization, selectWorkspace } = useSession();

  if (!user || !organization) {
    const missingIdentity = !user;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--aios-canvas)] px-5 py-10">
        <Card className="w-full max-w-lg p-6 sm:p-8">
          <Badge tone="warning">前置选择不完整</Badge>
          <h1 className="mt-4 text-2xl font-semibold">
            {missingIdentity ? "请先选择身份" : "请先选择 Organization"}
          </h1>
          <p className="mt-3 leading-7 text-[var(--aios-muted)]">
            当前会话缺少进入 Workspace 所需的上下文，请返回完成选择。
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            href={missingIdentity ? "/login" : "/organizations"}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            {missingIdentity ? "返回身份选择" : "返回 Organization 选择"}
          </Link>
        </Card>
      </main>
    );
  }

  function handleSelectWorkspace() {
    selectWorkspace(workspace.id);
    router.push("/workspace");
  }

  return (
    <main className="min-h-screen bg-[var(--aios-canvas)] px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <header>
          <Badge tone="neutral">{organization.name} · {user.name}</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            选择 Workspace
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--aios-muted)]">
            Workspace 承载业务目标、AI 员工与任务协作，本次试点聚焦 AI 智能业务线。
          </p>
        </header>

        <section className="mt-8" aria-labelledby="workspace-list-title">
          <h2 id="workspace-list-title" className="sr-only">可用 Workspace</h2>
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--aios-accent)_14%,var(--aios-surface))] text-[var(--aios-info-foreground)]"
                  aria-hidden="true"
                >
                  <PanelsTopLeft size={23} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{workspace.name}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--aios-muted)]">
                    {workspace.purpose}
                  </p>
                </div>
              </div>
              <Button
                className="w-full shrink-0 sm:w-auto"
                aria-label={`选择 Workspace ${workspace.name}`}
                onClick={handleSelectWorkspace}
              >
                进入 Workspace
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
