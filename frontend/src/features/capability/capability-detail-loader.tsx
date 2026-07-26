"use client";

import { AlertCircle, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import { CapabilityDetailScreen } from "./capability-detail-screen";
import {
  CapabilityRepositoryError,
  createCapabilityVersion,
  deprecateCapabilityVersion,
  evaluateCapabilityVersion,
  getCapability,
  getCapabilityPermission,
  publishCapabilityVersion,
  resumeCapabilityVersion,
  suspendCapabilityVersion,
} from "./mock/capability-repository";
import type { Capability, CapabilityPermissionDecision } from "./model";

type State =
  | { status: "idle" }
  | { status: "ready"; requestKey: string; item: Capability; permission: CapabilityPermissionDecision }
  | { status: "unavailable"; requestKey: string }
  | { status: "error"; requestKey: string };

export type CapabilityAction =
  | "CREATE_VERSION"
  | "EVALUATE"
  | "PUBLISH"
  | "SUSPEND"
  | "RESUME"
  | "DEPRECATE";

export type CapabilityActionState =
  | { status: "idle" }
  | { status: "working"; action: CapabilityAction; versionId?: string }
  | { status: "error"; message: string };

export function CapabilityDetailLoader({ capabilityId }: { capabilityId: string }) {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<State>({ status: "idle" });
  const [actionState, setActionState] = useState<CapabilityActionState>({ status: "idle" });
  const latestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${capabilityId}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !organization || !user || !workspace) return;
    const requestId = ++latestRef.current;
    let active = true;
    const scope = { organizationId: organization.id, workspaceId: workspace.id };
    const actor = { userId: user.id };
    void Promise.all([
      getCapability(scope, actor, capabilityId),
      getCapabilityPermission(scope, actor),
    ])
      .then(([item, permission]) => {
        if (active && requestId === latestRef.current) {
          setState({ status: "ready", requestKey, item, permission });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRef.current) return;
        if (
          error instanceof CapabilityRepositoryError &&
          (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
        ) {
          setState({ status: "unavailable", requestKey });
        } else {
          setState({ status: "error", requestKey });
        }
      });
    return () => {
      active = false;
    };
  }, [capabilityId, organization, requestKey, user, workspace]);

  if (!requestKey || !organization || !user || !workspace || state.status === "idle" || state.requestKey !== requestKey) {
    return complete ? (
      <Card role="status" className="mx-auto flex max-w-xl items-center gap-3 p-6">
        <LoaderCircle className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none" size={21} aria-hidden="true" />
        正在加载能力聚合、固定版本与治理证据…
      </Card>
    ) : null;
  }
  if (state.status === "unavailable") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3"><ShieldAlert size={21} className="mt-0.5 text-[var(--aios-warning-foreground)]" aria-hidden="true" /><div><h1 className="font-semibold">能力不可用</h1><p className="mt-2 text-sm text-[var(--aios-muted)]">当前 Organization、Workspace 或身份不能安全查看该能力。</p></div></div>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3"><AlertCircle size={21} className="mt-0.5 text-[var(--aios-error-foreground)]" aria-hidden="true" /><div><h1 className="font-semibold">能力数据加载失败</h1><p className="mt-2 text-sm text-[var(--aios-muted)]">本地数据未通过完整性校验，未展示不可信内容。</p></div></div>
      </Card>
    );
  }

  const scope = { organizationId: organization.id, workspaceId: workspace.id };
  const actor = { userId: user.id };
  const permission = state.permission;
  const readyRequestKey = requestKey;

  async function perform(action: CapabilityAction, versionId?: string, reason = "") {
    setActionState({ status: "working", action, ...(versionId ? { versionId } : {}) });
    try {
      let item: Capability;
      if (action === "CREATE_VERSION") {
        item = await createCapabilityVersion(scope, actor, capabilityId);
      } else if (action === "EVALUATE") {
        item = await evaluateCapabilityVersion(scope, actor, capabilityId, versionId!);
      } else if (action === "PUBLISH") {
        item = await publishCapabilityVersion(scope, actor, capabilityId, versionId!);
      } else if (action === "SUSPEND") {
        item = await suspendCapabilityVersion(scope, actor, capabilityId, versionId!, reason);
      } else if (action === "RESUME") {
        item = await resumeCapabilityVersion(scope, actor, capabilityId, versionId!);
      } else {
        item = await deprecateCapabilityVersion(scope, actor, capabilityId, versionId!);
      }
      setState({
        status: "ready",
        requestKey: readyRequestKey,
        item,
        permission,
      });
      setActionState({ status: "idle" });
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof CapabilityRepositoryError
            ? error.message
            : "能力版本状态变更失败，已保留最后一个有效状态。",
      });
    }
  }

  return (
    <CapabilityDetailScreen
      item={state.item}
      permission={state.permission}
      actionState={actionState}
      onAction={perform}
      scopeLabels={{ organizationName: organization.name, workspaceName: workspace.name }}
    />
  );
}
