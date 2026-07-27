"use client";

import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  createMcpServer,
  getToolPermission,
  ToolRepositoryError,
} from "./mock/tool-repository";
import type {
  CreateMcpServerInput,
  ToolPermissionDecision,
} from "./model";

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]";

type State =
  | { status: "loading" }
  | { status: "ready"; permission: ToolPermissionDecision }
  | { status: "error" };

export function McpCreateLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const complete = Boolean(hydrated && organization && user && workspace);

  useEffect(() => {
    if (!organization || !user || !workspace) return;
    let active = true;
    void getToolPermission(
      {
        organizationId: organization.id,
        workspaceId: workspace.id,
      },
      { userId: user.id },
    )
      .then((permission) => {
        if (active) setState({ status: "ready", permission });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
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
      <Card role="status" className="mx-auto flex max-w-xl items-center gap-3 p-6">
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载 MCP 注册权限…
      </Card>
    ) : null;
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <h1 className="font-semibold">MCP 注册上下文加载失败</h1>
      </Card>
    );
  }

  if (!state.permission.canManage) {
    return (
      <Card role="alert" className="mx-auto flex max-w-xl items-start gap-3 p-6">
        <ShieldAlert
          className="mt-0.5 text-[var(--aios-warning-foreground)]"
          size={21}
          aria-hidden="true"
        />
        <div>
          <h1 className="font-semibold">当前身份不能注册 MCP 服务</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
            {state.permission.reason}
          </p>
          <Link
            href="/tools/mcp"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--aios-primary)]"
          >
            返回 MCP 连接中心
          </Link>
        </div>
      </Card>
    );
  }

  const activeScope = {
    organizationId: organization.id,
    workspaceId: workspace.id,
  };
  const activeActor = { userId: user.id };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const input: CreateMcpServerInput = {
      serverIdentity: String(data.get("serverIdentity")).trim().toLowerCase(),
      displayName: String(data.get("displayName")).trim(),
      publisher: String(data.get("publisher")).trim(),
      serverVersion: String(data.get("serverVersion")).trim(),
      transport: "STDIO",
      endpointReference: String(data.get("endpointReference")).trim(),
      credentialReference:
        String(data.get("credentialReference")).trim() || undefined,
      toolCode: String(data.get("toolCode")).trim().toUpperCase(),
      toolName: String(data.get("toolName")).trim(),
      toolDescription: String(data.get("toolDescription")).trim(),
      actionName: String(data.get("actionName")).trim().toLowerCase(),
      actionDescription: String(data.get("actionDescription")).trim(),
      riskLevel: String(data.get("riskLevel")) as "R0" | "R1",
    };
    try {
      const server = await createMcpServer(activeScope, activeActor, input);
      router.push(`/tools/mcp/${server.id}`);
    } catch (caught) {
      setError(
        caught instanceof ToolRepositoryError
          ? caught.message
          : "MCP 服务注册失败，未写入不完整配置。",
      );
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/tools/mcp"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        返回 MCP 连接中心
      </Link>
      <header className="mt-3">
        <p className="text-sm font-semibold text-[var(--aios-primary)]">
          MCP 注册信息
        </p>
        <h1 className="mt-1 text-3xl font-semibold">注册 MCP 服务</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
          注册只创建服务注册信息和本地草稿工具版本候选版本；
          连接测试与人工发布前，不会出现在 AI 员工可绑定工具动作中。
        </p>
      </header>

      <form onSubmit={submit} className="mt-6 space-y-5">
        {error ? (
          <Card role="alert" className="flex items-start gap-3 p-4">
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
            <Server size={19} aria-hidden="true" />
            服务身份与传输方式
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold">
              服务身份
              <input
                required
                name="serverIdentity"
                pattern="[a-z][a-z0-9._-]{2,95}"
                placeholder="aios.requirement.reader"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              显示名称
              <input
                required
                name="displayName"
                placeholder="需求文档 MCP 服务"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              发布者
              <input
                required
                name="publisher"
                defaultValue="AIOS Internal"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              服务版本
              <input
                required
                name="serverVersion"
                defaultValue="1.0.0"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              传输方式
              <select disabled value="STDIO" className={inputClass}>
                <option value="STDIO">STDIO · MVP 受控运行时</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              端点引用
              <input
                required
                name="endpointReference"
                pattern="runtime://.+"
                placeholder="runtime://requirement-reader"
                className={inputClass}
              />
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wrench size={19} aria-hidden="true" />
            本地草稿工具版本
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold">
              工具编码
              <input
                required
                name="toolCode"
                pattern="[A-Za-z][A-Za-z0-9_]{2,63}"
                placeholder="REQUIREMENT_READ"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              工具名称
              <input
                required
                name="toolName"
                placeholder="需求文档读取"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold md:col-span-2">
              工具描述
              <textarea
                required
                name="toolDescription"
                rows={2}
                placeholder="说明用途、数据范围和明确禁止的副作用。"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              动作名称
              <input
                required
                name="actionName"
                pattern="[a-z][a-z0-9._-]{2,95}"
                placeholder="requirement.read"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              风险等级
              <select name="riskLevel" defaultValue="R0" className={inputClass}>
                <option value="R0">R0 · 只读无敏感副作用</option>
                <option value="R1">R1 · 只读但需要额外范围控制</option>
              </select>
            </label>
            <label className="text-sm font-semibold md:col-span-2">
              动作描述
              <textarea
                required
                name="actionDescription"
                rows={2}
                placeholder="说明精确读取动作与输出边界。"
                className={inputClass}
              />
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound size={19} aria-hidden="true" />
            身份认证与密钥
          </h2>
          <label className="mt-4 block text-sm font-semibold">
            密钥引用（可选）
            <input
              name="credentialReference"
              pattern="secret://.+"
              placeholder="secret://workspace/requirement-reader"
              className={inputClass}
            />
          </label>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-[var(--aios-muted)]">
            <ShieldCheck className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            页面不接受访问令牌、密码或密钥值。运行时只在授权调用时解析精确密钥引用，并且不会把凭据传给 AI 员工、模型、日志或成果。
          </p>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href="/tools/mcp"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold"
          >
            取消
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "正在注册…" : "创建草稿连接"}
          </Button>
        </div>
      </form>
    </div>
  );
}
