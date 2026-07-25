"use client";

import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";
import { organization } from "@/mock/fixtures";

export default function OrganizationsPage() {
  const router = useRouter();
  const { user, selectOrganization } = useSession();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--aios-canvas)] px-5 py-10">
        <Card className="w-full max-w-lg p-6 sm:p-8">
          <Badge tone="warning">缺少演示身份</Badge>
          <h1 className="mt-4 text-2xl font-semibold">请先选择身份</h1>
          <p className="mt-3 leading-7 text-[var(--aios-muted)]">
            当前会话还没有演示用户，无法选择 Organization。
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
            href="/login"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            返回身份选择
          </Link>
        </Card>
      </main>
    );
  }

  function handleSelectOrganization() {
    if (selectOrganization(organization.id)) {
      router.push("/workspaces");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--aios-canvas)] px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <header>
          <Badge tone="neutral">{user.name} · {user.role}</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            选择 Organization
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--aios-muted)]">
            Organization 是企业治理边界。此试点仅提供 README 定义的光位科技组织。
          </p>
        </header>

        <section className="mt-8" aria-labelledby="organization-list-title">
          <h2 id="organization-list-title" className="sr-only">可用 Organization</h2>
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--aios-primary)_12%,var(--aios-surface))] text-[var(--aios-primary)]"
                  aria-hidden="true"
                >
                  <Building2 size={23} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{organization.name}</h3>
                    <Badge tone="success">{organization.accessStatus}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--aios-muted)]">
                    {organization.id}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--aios-muted)]">
                    {organization.purpose}
                  </p>
                  <dl className="mt-4 grid gap-2 text-sm text-[var(--aios-muted)] sm:grid-cols-2">
                    <div>
                      <dt className="sr-only">当前职责</dt>
                      <dd>当前职责：{user.role}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">可访问 Workspace 数量</dt>
                      <dd>
                        可访问 Workspace：{organization.accessibleWorkspaceCount}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="sr-only">最近进入时间</dt>
                      <dd>最近进入：{organization.lastEnteredAt}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <Button
                className="w-full sm:w-auto"
                aria-label={`选择组织 ${organization.name}`}
                onClick={handleSelectOrganization}
              >
                进入组织
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
