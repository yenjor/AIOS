"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  getToolPermission,
  getToolSummary,
  listTools,
} from "./mock/tool-repository";
import type {
  ToolListItem,
  ToolPermissionDecision,
  ToolSummary,
} from "./model";
import { ToolCenterScreen } from "./tool-center-screen";

type State =
  | { status: "loading" }
  | {
      status: "ready";
      items: ToolListItem[];
      summary: ToolSummary;
      permission: ToolPermissionDecision;
    }
  | { status: "error" };

export function ToolCenterLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
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
      listTools(scope, actor),
      getToolSummary(scope, actor),
      getToolPermission(scope, actor),
    ])
      .then(([items, summary, permission]) => {
        if (active) setState({ status: "ready", items, summary, permission });
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
        正在加载工具版本、动作定义与健康状态…
      </Card>
    ) : null;
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto flex max-w-xl items-start gap-3 p-6">
        <AlertCircle
          className="mt-0.5 text-[var(--aios-error-foreground)]"
          size={21}
          aria-hidden="true"
        />
        <div>
          <h1 className="font-semibold">工具数据加载失败</h1>
          <p className="mt-2 text-sm text-[var(--aios-muted)]">
            本地数据未通过完整性校验，未展示不可信工具契约。
          </p>
        </div>
      </Card>
    );
  }

  return (
    <ToolCenterScreen
      {...state}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
    />
  );
}
