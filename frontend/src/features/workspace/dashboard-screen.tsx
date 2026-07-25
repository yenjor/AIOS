import {
  ArrowRight,
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  BadgeTone,
  DeepReadonly,
  WorkspaceDashboard,
} from "@/types/domain";

import { CurrentResponsibility } from "./current-responsibility";
import { MetricCard } from "./metric-card";

export interface DashboardScreenProps {
  snapshot: DeepReadonly<WorkspaceDashboard>;
}

const TASK_CREATION_DESCRIPTION =
  "将在 Task 创建流程实施阶段启用";
const TASK_CENTER_DESCRIPTION =
  "将在 Task Center 实施阶段启用";
const ARTIFACT_ACTION_DESCRIPTION =
  "将在 Artifact 审批与验收流程实施阶段启用";

const statusIcons: Record<BadgeTone, LucideIcon> = {
  info: CircleDot,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
};

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  const Icon = statusIcons[tone];

  return (
    <Badge tone={tone} className="gap-1.5">
      <Icon size={13} aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function DashboardScreen({ snapshot }: DashboardScreenProps) {
  const { metrics, agent, quickActions, tasks, todos, risks } = snapshot;

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Workspace 工作台
          </h1>
          <CurrentResponsibility />
          <p className="mt-2 text-sm text-[var(--aios-muted)]">
            当前为只读演示，Task 创建与处理尚未启用。
          </p>
        </div>
        <Button disabled>
          创建 Task
          <span className="sr-only">：{TASK_CREATION_DESCRIPTION}</span>
        </Button>
      </header>

      <section
        aria-label="Workspace 核心指标"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard label="我的待办" value={metrics.todo} />
        <MetricCard label="进行中 Task" value={metrics.runningTasks} />
        <MetricCard label="可用 AI 员工" value={metrics.availableAgents} />
        <MetricCard
          label="待验收 Artifact"
          value={metrics.pendingArtifacts}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Card
            role="region"
            aria-label="AI 研发员工"
            className="p-5"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 gap-4">
                <span
                  className="grid size-14 shrink-0 place-items-center rounded-xl bg-[var(--aios-accent)] text-[var(--aios-surface)]"
                  aria-hidden="true"
                >
                  <Bot size={26} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{agent.name}</h2>
                    <StatusBadge
                      label={agent.status}
                      tone={
                        agent.status === "运行中"
                          ? "success"
                          : agent.status === "暂停"
                            ? "warning"
                            : "error"
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm text-[var(--aios-muted)]">
                    责任人：{agent.owner}
                  </p>
                  <p className="mt-1 text-sm text-[var(--aios-muted)]">
                    自治等级：{agent.autonomyLevel}
                  </p>
                </div>
              </div>

              <dl className="grid shrink-0 grid-cols-3 gap-3 text-center sm:gap-6">
                <div
                  role="group"
                  aria-label="今日完成"
                  className="flex flex-col"
                >
                  <dt className="order-2 mt-1 text-xs text-[var(--aios-muted)]">
                    今日完成
                  </dt>
                  <dd className="order-1 text-2xl font-semibold tabular-nums">
                    {agent.completedToday}
                  </dd>
                </div>
                <div
                  role="group"
                  aria-label="运行中"
                  className="flex flex-col"
                >
                  <dt className="order-2 mt-1 text-xs text-[var(--aios-muted)]">
                    运行中
                  </dt>
                  <dd className="order-1 text-2xl font-semibold tabular-nums">
                    {agent.runningTasks}
                  </dd>
                </div>
                <div
                  role="group"
                  aria-label="累计 Artifact"
                  className="flex flex-col"
                >
                  <dt className="order-2 mt-1 text-xs text-[var(--aios-muted)]">
                    累计 Artifact
                  </dt>
                  <dd className="order-1 text-2xl font-semibold tabular-nums">
                    {agent.artifactsProduced}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card
            role="region"
            aria-label="快速创建"
            className="p-5"
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck
                className="text-[var(--aios-primary)]"
                size={19}
                aria-hidden="true"
              />
              <h2 className="font-semibold">快速创建</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant="secondary"
                  className="min-h-20 whitespace-normal px-3"
                  disabled
                >
                  {action.label}
                  <span className="sr-only">
                    ：{TASK_CREATION_DESCRIPTION}
                  </span>
                </Button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h2 className="font-semibold">最近 Task</h2>
              <Button
                variant="ghost"
                className="min-h-9 px-2"
                disabled
              >
                查看全部
                <ArrowRight aria-hidden="true" size={16} />
                <span className="sr-only">：{TASK_CENTER_DESCRIPTION}</span>
              </Button>
            </div>
            <div
              role="region"
              aria-label="最近 Task 表格，可横向滚动"
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--aios-primary)]"
            >
              <table className="w-full min-w-[720px] border-t border-[var(--aios-control-border)] text-left text-sm">
                <caption className="sr-only">最近 Task 列表</caption>
                <thead className="bg-[var(--aios-canvas)] text-[var(--aios-muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Task
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      类型
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      AI 员工
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      状态
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      更新时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-t border-[color-mix(in_srgb,var(--aios-muted)_18%,var(--aios-surface))]"
                    >
                      <th scope="row" className="px-5 py-3 font-medium">
                        {task.title}
                      </th>
                      <td className="px-5 py-3 text-[var(--aios-muted)]">
                        {task.type}
                      </td>
                      <td className="px-5 py-3">{task.agentName}</td>
                      <td className="px-5 py-3">
                        <StatusBadge label={task.status} tone={task.tone} />
                      </td>
                      <td className="px-5 py-3 text-[var(--aios-muted)]">
                        {task.updatedAt}
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-8 text-center text-[var(--aios-muted)]"
                      >
                        暂无最近 Task
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside aria-label="个人待办与风险" className="min-w-0 space-y-5">
          <Card
            role="region"
            aria-label="我的待办"
            className="p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">我的待办</h2>
                <p className="mt-1 text-xs text-[var(--aios-muted)]">
                  当前显示 {todos.length} 项，共 {metrics.todo} 项
                </p>
              </div>
              <Badge tone="info">{metrics.todo}</Badge>
            </div>
            <ul className="mt-3 divide-y divide-[color-mix(in_srgb,var(--aios-muted)_18%,var(--aios-surface))]">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-center gap-3 py-4">
                  <FileCheck2
                    className="shrink-0 text-[var(--aios-primary)]"
                    aria-hidden="true"
                    size={19}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{todo.title}</p>
                    <p className="mt-1 text-xs text-[var(--aios-muted)]">
                      {todo.artifactType}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="min-h-9 shrink-0 px-2"
                    disabled
                  >
                    {todo.action}
                    <span className="sr-only">
                      ：{ARTIFACT_ACTION_DESCRIPTION}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            {todos.length === 0 ? (
              <p className="mt-4 rounded-lg bg-[var(--aios-canvas)] px-4 py-5 text-center text-sm text-[var(--aios-muted)]">
                暂无待办
              </p>
            ) : null}
          </Card>

          <Card
            role="region"
            aria-label="风险提示"
            className="p-5"
          >
            <h2 className="font-semibold">风险提示</h2>
            <ul className="mt-4 space-y-3">
              {risks.map((risk) => {
                const severity = risk.tone === "error" ? "错误" : "警告";

                return (
                  <li
                    key={risk.id}
                    aria-label={`${severity}风险：${risk.title}`}
                    className="flex gap-3 rounded-lg bg-[var(--aios-canvas)] p-3"
                  >
                    <ShieldAlert
                      className={
                        risk.tone === "error"
                          ? "shrink-0 text-[var(--aios-error-foreground)]"
                          : "shrink-0 text-[var(--aios-warning-foreground)]"
                      }
                      aria-hidden="true"
                      size={19}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{risk.title}</p>
                        <Badge tone={risk.tone}>{severity}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
                        {risk.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {risks.length === 0 ? (
              <p className="mt-4 rounded-lg bg-[var(--aios-canvas)] px-4 py-5 text-center text-sm text-[var(--aios-muted)]">
                暂无风险提示
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
