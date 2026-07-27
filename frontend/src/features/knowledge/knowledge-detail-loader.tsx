"use client";

import { AlertCircle, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  KnowledgeDetailScreen,
  type KnowledgeDetailAction,
  type KnowledgeDetailActionState,
} from "./knowledge-detail-screen";
import {
  digestKnowledgeContent,
  getKnowledge,
  getKnowledgePermission,
  invalidateKnowledgeVersion,
  KnowledgeRepositoryError,
  publishKnowledgeVersion,
  restoreKnowledgeVersion,
  submitKnowledgeCorrection,
} from "./mock/knowledge-repository";
import type {
  KnowledgeItem,
  KnowledgePermissionDecision,
} from "./model";

type LoaderState =
  | { status: "idle" }
  | {
      status: "ready";
      requestKey: string;
      item: KnowledgeItem;
      permission: KnowledgePermissionDecision;
    }
  | { status: "unavailable"; requestKey: string }
  | { status: "error"; requestKey: string };

export function KnowledgeDetailLoader({
  knowledgeId,
}: {
  knowledgeId: string;
}) {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const [actionState, setActionState] =
    useState<KnowledgeDetailActionState>({ status: "idle" });
  const latestRequestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${knowledgeId}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !organization || !user || !workspace) {
      return;
    }
    const requestId = ++latestRequestRef.current;
    let active = true;
    const scope = {
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    const actor = { userId: user.id };
    void Promise.all([
      getKnowledge(scope, actor, knowledgeId),
      getKnowledgePermission(scope, actor),
    ])
      .then(([item, permission]) => {
        if (active && requestId === latestRequestRef.current) {
          setState({ status: "ready", requestKey, item, permission });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }
        if (
          error instanceof KnowledgeRepositoryError &&
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
  }, [knowledgeId, organization, requestKey, user, workspace]);

  if (
    !requestKey ||
    !organization ||
    !user ||
    !workspace ||
    state.status === "idle" ||
    state.requestKey !== requestKey
  ) {
    return complete ? (
      <Card
        role="status"
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
      >
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载知识条目与固定版本证据…
      </Card>
    ) : null;
  }

  if (state.status === "unavailable") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 text-[var(--aios-warning-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">知识条目不可用</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              当前组织、工作空间或身份不能安全查看该知识条目。敏感条目不会泄露其存在性。
            </p>
          </div>
        </div>
      </Card>
    );
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
            <h1 className="font-semibold">知识库数据加载失败</h1>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              本地数据未通过完整性校验，未展示不可信内容。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const scope = {
    organizationId: organization.id,
    workspaceId: workspace.id,
  };
  const actor = { userId: user.id };
  const readyPermission = state.permission;
  const readyRequestKey = requestKey;

  async function handleVersionAction(
    action: Exclude<KnowledgeDetailAction, "CORRECT">,
    versionId: string,
    reason: string,
  ) {
    setActionState({ status: "working", action, versionId });
    try {
      const item =
        action === "PUBLISH"
          ? await publishKnowledgeVersion(
              scope,
              actor,
              knowledgeId,
              versionId,
            )
          : action === "INVALIDATE"
            ? await invalidateKnowledgeVersion(
                scope,
                actor,
                knowledgeId,
                versionId,
                reason,
              )
            : await restoreKnowledgeVersion(
                scope,
                actor,
                knowledgeId,
                versionId,
                reason,
              );
      setState({
        status: "ready",
        requestKey: readyRequestKey,
        item,
        permission: readyPermission,
      });
      setActionState({ status: "idle" });
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof KnowledgeRepositoryError
            ? error.message
            : "知识版本状态变更失败，已保留最后一个有效状态。",
      });
    }
  }

  async function handleCorrection(
    versionId: string,
    reason: string,
    evidenceReference: string,
  ) {
    setActionState({ status: "working", action: "CORRECT", versionId });
    try {
      const evidenceDigest = await digestKnowledgeContent(
        evidenceReference.trim(),
      );
      const item = await submitKnowledgeCorrection(
        scope,
        actor,
        knowledgeId,
        {
          targetVersionId: versionId,
          reason,
          evidenceReference,
          evidenceDigest,
        },
      );
      setState({
        status: "ready",
        requestKey: readyRequestKey,
        item,
        permission: readyPermission,
      });
      setActionState({ status: "idle" });
    } catch (error) {
      setActionState({
        status: "error",
        message:
          error instanceof KnowledgeRepositoryError
            ? error.message
            : "纠错提交失败，未写入不完整记录。",
      });
      throw error;
    }
  }

  return (
    <KnowledgeDetailScreen
      item={state.item}
      permission={state.permission}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
      actionState={actionState}
      onVersionAction={handleVersionAction}
      onCorrection={handleCorrection}
    />
  );
}
