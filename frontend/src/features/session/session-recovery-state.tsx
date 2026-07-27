import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function SessionRecoveryState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--aios-canvas)] px-5 py-10">
      <Card
        role="status"
        aria-live="polite"
        className="w-full max-w-lg p-6 sm:p-8"
      >
        <Badge tone="info">恢复工作范围</Badge>
        <h1 className="mt-4 text-2xl font-semibold">正在恢复模拟会话</h1>
        <p className="mt-3 leading-7 text-[var(--aios-muted)]">
          正在从当前浏览器标签页恢复已验证的身份、组织与工作空间。
        </p>
      </Card>
    </main>
  );
}
