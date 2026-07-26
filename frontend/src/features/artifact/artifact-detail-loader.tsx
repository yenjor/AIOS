"use client";

import { AlertCircle, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";

import { ArtifactDetailScreen } from "./artifact-detail-screen";
import {
  ArtifactRepositoryError,
  getArtifact,
} from "./mock/artifact-repository";
import type { TechnicalSolutionArtifact } from "./model";

type LoaderState =
  | { status: "idle" }
  | {
      status: "ready";
      requestKey: string;
      artifact: TechnicalSolutionArtifact;
    }
  | { status: "unavailable"; requestKey: string }
  | { status: "error"; requestKey: string };

export function ArtifactDetailLoader({ artifactId }: { artifactId: string }) {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<LoaderState>({ status: "idle" });
  const latestRequestRef = useRef(0);
  const complete = Boolean(hydrated && organization && user && workspace);
  const requestKey =
    complete && organization && user && workspace
      ? `${organization.id}:${workspace.id}:${user.id}:${artifactId}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !organization || !user || !workspace) {
      return;
    }
    const requestId = ++latestRequestRef.current;
    let active = true;

    void getArtifact(
      {
        organizationId: organization.id,
        workspaceId: workspace.id,
      },
      { userId: user.id },
      artifactId,
    )
      .then((artifact) => {
        if (active && requestId === latestRequestRef.current) {
          setState({ status: "ready", requestKey, artifact });
        }
      })
      .catch((error: unknown) => {
        if (!active || requestId !== latestRequestRef.current) {
          return;
        }
        if (
          error instanceof ArtifactRepositoryError &&
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
  }, [artifactId, organization, requestKey, user, workspace]);

  if (
    !requestKey ||
    !complete ||
    !organization ||
    !user ||
    !workspace
  ) {
    return null;
  }

  if (state.status === "idle" || state.requestKey !== requestKey) {
    return (
      <Card
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-xl items-center gap-3 p-6"
      >
        <LoaderCircle
          className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none"
          size={21}
          aria-hidden="true"
        />
        正在加载 Artifact 只读详情…
      </Card>
    );
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
            <h1 className="font-semibold">Artifact 不可用</h1>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              当前 Organization、Workspace 或身份无法安全查看该 Artifact。
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
            <h1 className="font-semibold">Artifact 数据加载失败</h1>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              本地数据未通过完整性校验，未展示不可信内容。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <ArtifactDetailScreen
      artifact={state.artifact}
      scopeLabels={{
        organizationName: organization.name,
        workspaceName: workspace.name,
      }}
      viewer={{ name: user.name, role: user.role }}
    />
  );
}
