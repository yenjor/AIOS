"use client";

import {
  AlertCircle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  Boxes,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  listPublishedCapabilityOptions,
} from "@/features/capability/mock/capability-repository";
import type {
  CapabilitySelectionOption,
  CapabilityTaskType,
} from "@/features/capability/model";
import { useSession } from "@/features/session/session-provider";
import { users } from "@/mock/fixtures";

import {
  AgentRepositoryError,
  createAgent,
  getAgentPermission,
} from "./mock/agent-repository";
import type {
  AgentPermissionDecision,
  AutonomyLevel,
  CreateAgentInput,
} from "./model";

const taskTypes: CapabilityTaskType[] = [
  "GENERATE_TECHNICAL_DESIGN",
  "ANALYZE_REQUIREMENT",
  "CODE_REVIEW",
  "AUTOMATED_TEST",
];

const taskTypeLabels: Record<CapabilityTaskType, string> = {
  GENERATE_TECHNICAL_DESIGN: "生成技术方案",
  ANALYZE_REQUIREMENT: "分析需求",
  CODE_REVIEW: "代码审查",
  AUTOMATED_TEST: "自动测试",
};

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]";

type LoaderState =
  | { status: "loading" }
  | {
      status: "ready";
      permission: AgentPermissionDecision;
      capabilities: CapabilitySelectionOption[];
    }
  | { status: "error"; message: string };

export function AgentCreateLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const router = useRouter();
  const [state, setState] = useState<LoaderState>({ status: "loading" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const complete = Boolean(hydrated && organization && user && workspace);

  useEffect(() => {
    if (!organization || !user || !workspace) return;
    let active = true;
    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };
    void Promise.all([
      getAgentPermission(scope, actor),
      ...taskTypes.map((taskType) =>
        listPublishedCapabilityOptions(scope, actor, taskType),
      ),
    ])
      .then(([permission, ...capabilityPages]) => {
        if (!active) return;
        const byVersionId = new Map<string, CapabilitySelectionOption>();
        for (const option of capabilityPages.flat()) {
          byVersionId.set(option.versionRef.versionId, option);
        }
        setState({
          status: "ready",
          permission,
          capabilities: [...byVersionId.values()].sort((left, right) =>
            left.capabilityName.localeCompare(
              right.capabilityName,
              "zh-CN",
            ),
          ),
        });
      })
      .catch((caught: unknown) => {
        if (active) {
          setState({
            status: "error",
            message:
              caught instanceof AgentRepositoryError
                ? caught.message
                : "Agent Builder 上下文加载失败。",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [organization, user, workspace]);

  if (
    !complete ||
    !organization ||
    !user ||
    !workspace ||
    state.status === "loading"
  ) {
    return complete ? (
      <Card
        role="status"
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
      >
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={20}
          aria-hidden="true"
        />
        正在加载 Agent Builder 权限与 Published CapabilityVersion…
      </Card>
    ) : null;
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 text-[var(--aios-error-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">Agent Builder 加载失败</h1>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              {state.message}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!state.permission.canManage) {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 text-[var(--aios-warning-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">当前身份不能创建 AI 员工</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              {state.permission.reason}
            </p>
            <Link
              href="/agents"
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--aios-primary)] underline-offset-4 hover:underline"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              返回 AI 员工中心
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const activeOrganization = organization;
  const activeWorkspace = workspace;
  const activeUser = user;
  const capabilities = state.capabilities;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const capabilityVersionIds = data
      .getAll("capabilityVersionId")
      .map(String);
    const assigned = capabilities.filter((option) =>
      capabilityVersionIds.includes(option.versionRef.versionId),
    );
    const additionalToolAction = String(data.get("toolAction")).trim();
    const toolActions = Array.from(
      new Set([
        ...assigned.flatMap((option) => option.toolActions),
        ...(additionalToolAction ? [additionalToolAction] : []),
      ]),
    );
    const includeKnowledgeScope =
      data.get("includeKnowledgeScope") === "on" ||
      assigned.some((option) => option.knowledgeRequired);
    const input: CreateAgentInput = {
      code: String(data.get("code")).trim().toUpperCase(),
      name: String(data.get("name")).trim(),
      roleDescription: String(data.get("roleDescription")).trim(),
      humanOwnerId: String(data.get("humanOwnerId")),
      jobTitle: String(data.get("jobTitle")).trim(),
      capabilityVersionIds,
      autonomyLevel: String(data.get("autonomyLevel")) as AutonomyLevel,
      includeKnowledgeScope,
      toolActions,
    };
    try {
      const agent = await createAgent(
        {
          organizationId: activeOrganization.id,
          workspaceId: activeWorkspace.id,
        },
        { userId: activeUser.id },
        input,
      );
      router.push(`/agents/${agent.id}`);
    } catch (caught) {
      setError(
        caught instanceof AgentRepositoryError
          ? caught.message
          : "AI 员工创建失败，未写入不完整配置。",
      );
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/agents"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回 AI 员工中心
      </Link>
      <header className="mt-3">
        <p className="text-sm font-semibold text-[var(--aios-primary)]">
          Agent Builder
        </p>
        <h1 className="mt-1 text-3xl font-semibold">创建 AI 员工 Draft</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
          Agent 是 AI 员工身份与版本容器。配置只记录 Human Owner、固定版本引用和权限上限；
          创建后必须通过确定性测试并显式发布，不能直接进入 Task。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error ? (
          <Card
            role="alert"
            className="flex items-start gap-3 border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] p-4"
          >
            <AlertCircle
              className="mt-0.5 text-[var(--aios-error-foreground)]"
              size={19}
              aria-hidden="true"
            />
            <p className="text-sm">{error}</p>
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bot size={19} aria-hidden="true" />
            Agent Identity 与 Human Owner
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold">
              Agent Code
              <input
                required
                name="code"
                pattern="[A-Za-z][A-Za-z0-9_]{2,63}"
                placeholder="AI_SOLUTION_ARCHITECT"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              AI 员工名称
              <input
                required
                name="name"
                placeholder="AI 解决方案架构师"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Job Title
              <input
                required
                name="jobTitle"
                placeholder="AI 解决方案架构师"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Human Owner
              <select
                name="humanOwnerId"
                defaultValue="user-lead"
                className={inputClass}
              >
                {users
                  .filter(({ id }) => id !== "user-auditor")
                  .map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.name} · {candidate.role}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-semibold md:col-span-2">
              Role Description
              <textarea
                required
                name="roleDescription"
                rows={3}
                placeholder="说明职责、输入、产出、协作方式和明确禁止事项。"
                className={inputClass}
              />
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Boxes size={19} aria-hidden="true" />
            Capability Assignment
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
            只能绑定当前 Workspace 可用的 Published CapabilityVersion。绑定是能力上限，
            不会绕过 TaskType、Permission、知识或 Tool 校验。
          </p>
          {capabilities.length ? (
            <fieldset className="mt-4 grid gap-3">
              <legend className="sr-only">
                选择 CapabilityVersion，至少一项
              </legend>
              {capabilities.map((option, index) => (
                <label
                  key={option.versionRef.versionId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4 text-sm"
                >
                  <input
                    type="checkbox"
                    name="capabilityVersionId"
                    value={option.versionRef.versionId}
                    defaultChecked={
                      option.taskType === "GENERATE_TECHNICAL_DESIGN" ||
                      (index === 0 &&
                        !capabilities.some(
                          ({ taskType }) =>
                            taskType === "GENERATE_TECHNICAL_DESIGN",
                        ))
                    }
                    className="mt-1 accent-[var(--aios-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {option.capabilityName} ·{" "}
                      {taskTypeLabels[option.taskType]}
                    </span>
                    <span className="mt-1 block break-all font-mono text-xs text-[var(--aios-muted)]">
                      {option.versionRef.versionId} ·{" "}
                      {option.versionRef.digest}
                    </span>
                    <span className="mt-2 block leading-5 text-[var(--aios-muted)]">
                      Knowledge {option.knowledgeRequired ? "Required" : "Optional"} ·
                      Tool Actions{" "}
                      {option.toolActions.length
                        ? option.toolActions.join(", ")
                        : "None"}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-[var(--aios-control-border)] p-4 text-sm"
            >
              当前没有可绑定的 Published CapabilityVersion，请先在能力中心完成发布。
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck size={19} aria-hidden="true" />
            Runtime 权限上限
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold">
              AutonomyLevel
              <select
                name="autonomyLevel"
                defaultValue="L1辅助"
                className={inputClass}
              >
                <option value="L0建议">L0建议 · 仅输出建议</option>
                <option value="L1辅助">L1辅助 · 默认，需要人工验收</option>
                <option value="L2受控执行">L2受控执行 · 仅低风险受控动作</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              额外只读 Tool Action（可选）
              <input
                name="toolAction"
                placeholder="codegraph.context"
                className={inputClass}
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="includeKnowledgeScope"
                defaultChecked
                className="mt-1 accent-[var(--aios-primary)]"
              />
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <BrainCircuit size={17} aria-hidden="true" />
                  绑定当前 Workspace 内部知识范围
                </span>
                <span className="mt-1 block leading-6 text-[var(--aios-muted)]">
                  只保存 Knowledge Scope Assignment 与 Citation Required；
                  不保存知识正文，Runtime 仍执行权限交集。
                </span>
              </span>
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wrench size={19} aria-hidden="true" />
            发布门禁
          </h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--aios-muted)] sm:grid-cols-2">
            <li>• Capability Assignment 可解析</li>
            <li>• Knowledge Scope 与 Citation 有效</li>
            <li>• Tool Grant 只读且风险不超上限</li>
            <li>• Permission Default Deny 负向测试</li>
            <li>• Artifact Draft 生成测试</li>
            <li>• Prompt Injection 防护测试</li>
          </ul>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href="/agents"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold"
          >
            取消
          </Link>
          <Button
            disabled={saving || capabilities.length === 0}
            type="submit"
          >
            {saving ? "正在创建…" : "创建 Draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}
