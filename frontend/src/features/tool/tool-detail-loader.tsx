"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import { getMcpServer, getTool } from "./mock/tool-repository";
import type { McpServerRegistration, Tool } from "./model";
import { ToolDetailScreen } from "./tool-detail-screen";

type State =
  | { status: "loading" }
  | { status: "ready"; tool: Tool; server: McpServerRegistration }
  | { status: "error" };

export function ToolDetailLoader({ toolId }: { toolId: string }) {
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
    void getTool(scope, actor, toolId)
      .then(async (tool) => ({
        tool,
        server: await getMcpServer(
          scope,
          actor,
          tool.versions.at(-1)!.mcpServerId,
        ),
      }))
      .then(({ tool, server }) => {
        if (active) setState({ status: "ready", tool, server });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [organization, toolId, user, workspace]);

  if (!complete || state.status === "loading") {
    return complete ? (
      <Card role="status" className="mx-auto flex max-w-xl items-center gap-3 p-6">
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载 Tool Aggregate 与固定 Action Contract…
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
          <h1 className="font-semibold">Tool 不可用</h1>
          <p className="mt-2 text-sm text-[var(--aios-muted)]">
            当前 Workspace 或身份不能安全解析该 Tool。
          </p>
        </div>
      </Card>
    );
  }

  return <ToolDetailScreen tool={state.tool} server={state.server} />;
}
