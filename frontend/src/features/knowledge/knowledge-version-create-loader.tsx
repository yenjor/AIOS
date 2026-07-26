"use client";

import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  KnowledgeVersionForm,
  type KnowledgeContentValues,
} from "./knowledge-import-form";
import {
  createKnowledgeVersion,
  digestKnowledgeContent,
  getKnowledge,
  getKnowledgePermission,
  KnowledgeRepositoryError,
} from "./mock/knowledge-repository";

type LoaderState =
  | { status: "idle" }
  | { status: "allowed"; requestKey: string }
  | { status: "forbidden"; requestKey: string }
  | { status: "error"; requestKey: string };

export function KnowledgeVersionCreateLoader({
  knowledgeId,
}: {
  knowledgeId: string;
}) {
  const router = useRouter();
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
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
      getKnowledgePermission(scope, actor),
      getKnowledge(scope, actor, knowledgeId),
    ])
      .then(([permission, item]) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }
        const hasDraft = item.versions.some(
          ({ effectiveStatus }) => effectiveStatus === "DRAFT",
        );
        setState({
          status: permission.canManage && !hasDraft ? "allowed" : "forbidden",
          requestKey,
        });
      })
      .catch(() => {
        if (active && requestId === latestRequestRef.current) {
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
        正在校验版本创建条件…
      </Card>
    ) : null;
  }

  if (state.status === "forbidden") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 text-[var(--aios-warning-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">不能创建新版本</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              当前身份无管理权限，或该知识条目已存在待处理的 Draft。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <h1 className="font-semibold">版本条件校验失败</h1>
        <p className="mt-2 text-sm text-[var(--aios-muted)]">
          系统未创建知识版本。
        </p>
      </Card>
    );
  }

  async function handleSubmit(values: KnowledgeContentValues) {
    if (!organization || !user || !workspace) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const contentDigest = await digestKnowledgeContent(values.content);
      await createKnowledgeVersion(
        {
          organizationId: organization.id,
          workspaceId: workspace.id,
        },
        { userId: user.id },
        knowledgeId,
        {
          ...values,
          fileName: values.fileName.trim(),
          contentDigest,
        },
      );
      router.push(`/knowledge/${knowledgeId}`);
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof KnowledgeRepositoryError
          ? cause.message
          : "知识版本创建失败。",
      );
    }
  }

  return (
    <KnowledgeVersionForm
      busy={busy}
      error={error}
      knowledgeId={knowledgeId}
      onSubmit={handleSubmit}
    />
  );
}
