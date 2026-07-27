"use client";

import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";
import { users } from "@/mock/fixtures";

export default function LoginPage() {
  const router = useRouter();
  const { selectUser } = useSession();

  function handleSelectUser(userId: string) {
    if (selectUser(userId)) {
      router.push("/organizations");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--aios-canvas)] px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <header className="max-w-3xl">
          <Badge tone="info">AIOS 页面试点</Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--aios-text)] sm:text-4xl">
            选择演示身份
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--aios-muted)]">
            这是用于验证角色化工作体验的演示身份选择，不是真实登录，也不会创建账号或凭证。
          </p>
        </header>

        <section className="mt-8" aria-labelledby="identity-list-title">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--aios-primary)_12%,var(--aios-surface))] text-[var(--aios-primary)]"
              aria-hidden="true"
            >
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 id="identity-list-title" className="text-lg font-semibold">
                AI 智能业务线角色
              </h2>
              <p className="mt-1 text-sm text-[var(--aios-muted)]">
                选择身份后进入组织与工作空间。
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <li key={user.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-4">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--aios-canvas)] text-[var(--aios-muted)]"
                      aria-hidden="true"
                    >
                      <UserRound size={21} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[var(--aios-text)]">{user.name}</h3>
                      <p className="mt-1 text-sm text-[var(--aios-muted)]">{user.role}</p>
                    </div>
                  </div>
                  <Button
                    className="mt-6 w-full"
                    aria-label={`使用${user.name}（${user.role}）身份`}
                    onClick={() => handleSelectUser(user.id)}
                  >
                    使用此身份
                    <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
