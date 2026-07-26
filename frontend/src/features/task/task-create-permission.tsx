"use client";

import Link from "next/link";
import {
  type AnchorHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSession } from "@/features/session/session-provider";
import { cn } from "@/lib/cn";

import { getTaskPermission } from "./mock/task-repository";

export type TaskCreatePermissionStatus =
  | "idle"
  | "loading"
  | "allowed"
  | "denied"
  | "error";

interface PermissionState {
  requestKey?: string;
  status: Exclude<TaskCreatePermissionStatus, "idle">;
}

export interface TaskCreatePermissionResult {
  status: TaskCreatePermissionStatus;
  canCreate: boolean;
}

export function useTaskCreatePermission(): TaskCreatePermissionResult {
  const { hydrated, organization, user, workspace } = useSession();
  const [state, setState] = useState<PermissionState>({
    status: "loading",
  });
  const latestRequestRef = useRef(0);
  const requestKey =
    hydrated && user && organization && workspace
      ? `${organization.id}:${workspace.id}:${user.id}`
      : undefined;

  useEffect(() => {
    if (!requestKey || !user || !organization || !workspace) {
      return;
    }

    const requestId = ++latestRequestRef.current;
    let active = true;

    void getTaskPermission(
      {
        organizationId: organization.id,
        workspaceId: workspace.id,
      },
      { userId: user.id },
    )
      .then((decision) => {
        if (active && requestId === latestRequestRef.current) {
          setState({
            requestKey,
            status: decision.allowed ? "allowed" : "denied",
          });
        }
      })
      .catch(() => {
        if (active && requestId === latestRequestRef.current) {
          setState({ requestKey, status: "error" });
        }
      });

    return () => {
      active = false;
    };
  }, [organization, requestKey, user, workspace]);

  if (!requestKey) {
    return { status: "idle", canCreate: false };
  }

  if (state.requestKey !== requestKey) {
    return { status: "loading", canCreate: false };
  }

  return {
    status: state.status,
    canCreate: state.status === "allowed",
  };
}

export interface TaskCreateLinkProps
  extends Pick<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "aria-label" | "className" | "title"
  > {
  children: ReactNode;
}

export function TaskCreateLink({
  children,
  className,
  ...props
}: TaskCreateLinkProps) {
  const { canCreate } = useTaskCreatePermission();

  if (!canCreate) {
    return null;
  }

  return (
    <Link
      href="/tasks/new"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--aios-primary)] px-4 text-sm font-semibold text-[var(--aios-surface)] transition hover:bg-[color-mix(in_srgb,var(--aios-primary)_85%,var(--aios-navigation))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aios-primary)]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
