"use client";

import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import {
  KnowledgeRegistrationForm,
  type KnowledgeRegistrationValues,
} from "./knowledge-import-form";
import {
  digestKnowledgeContent,
  getKnowledgePermission,
  KnowledgeRepositoryError,
  registerKnowledge,
} from "./mock/knowledge-repository";

type PermissionState =
  | { status: "idle" }
  | { status: "allowed"; requestKey: string }
  | { status: "forbidden"; requestKey: string }
  | { status: "error"; requestKey: string };

export function KnowledgeCreateLoader() {
  const router = useRouter();
  const { hydrated, organization, user, workspace } = useSession();
  const [permissionState, setPermissionState] =
    useState<PermissionState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const latestRequestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !organization || !user || !workspace) {
      return;
    }
    const requestId = ++latestRequestRef.current;
    let active = true;
    void getKnowledgePermission(
      {
        organizationId: organization.id,
        workspaceId: workspace.id,
      },
      { userId: user.id },
    )
      .then((permission) => {
        if (active && requestId === latestRequestRef.current) {
          setPermissionState({
            status: permission.canManage ? "allowed" : "forbidden",
            requestKey,
          });
        }
      })
      .catch(() => {
        if (active && requestId === latestRequestRef.current) {
          setPermissionState({ status: "error", requestKey });
        }
      });
    return () => {
      active = false;
    };
  }, [organization, requestKey, user, workspace]);

  if (
    !requestKey ||
    !organization ||
    !user ||
    !workspace ||
    permissionState.status === "idle" ||
    permissionState.requestKey !== requestKey
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
        正在校验知识库管理权限…
      </Card>
    ) : null;
  }

  if (permissionState.status === "forbidden") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 text-[var(--aios-warning-foreground)]"
            size={21}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold">当前身份不能新增知识</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
              只有研发负责人或工作空间管理员可注册、创建版本和发布正式知识。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (permissionState.status === "error") {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <h1 className="font-semibold">权限校验失败</h1>
        <p className="mt-2 text-sm text-[var(--aios-muted)]">
          系统未执行知识库写入。
        </p>
      </Card>
    );
  }

  async function handleSubmit(values: KnowledgeRegistrationValues) {
    if (!organization || !user || !workspace) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const contentDigest = await digestKnowledgeContent(values.content);
      const item = await registerKnowledge(
        {
          organizationId: organization.id,
          workspaceId: workspace.id,
        },
        { userId: user.id },
        {
          ...values,
          code: values.code.trim(),
          title: values.title.trim(),
          description: values.description.trim(),
          sourceLocation: values.sourceLocation.trim(),
          sourceAuthority: values.sourceAuthority.trim(),
          fileName: values.fileName.trim(),
          contentDigest,
          purpose: "software_engineering_tasks",
        },
      );
      router.push(`/knowledge/${item.id}`);
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof KnowledgeRepositoryError
          ? cause.message
          : "知识注册失败，未写入不完整数据。",
      );
    }
  }

  return (
    <KnowledgeRegistrationForm
      busy={busy}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
