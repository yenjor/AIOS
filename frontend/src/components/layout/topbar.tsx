"use client";

import {
  Bell,
  Building2,
  Menu,
  PanelsTopLeft,
  Plus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/session/session-provider";

export interface TopbarProps {
  navigationOpen: boolean;
  onOpenNavigation: () => void;
  navigationTriggerRef?: Ref<HTMLButtonElement>;
}

export function Topbar({
  navigationOpen,
  onOpenNavigation,
  navigationTriggerRef,
}: TopbarProps) {
  const { organization, user, workspace } = useSession();

  if (!user || !organization || !workspace) {
    return null;
  }

  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] bg-[var(--aios-surface)] px-4 sm:px-5 lg:px-7">
      <div className="flex min-w-0 items-center gap-2">
        <button
          ref={navigationTriggerRef}
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--aios-text)] transition hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)] md:hidden"
          aria-label="打开主导航"
          aria-controls="aios-main-navigation"
          aria-expanded={navigationOpen}
          onClick={onOpenNavigation}
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/organizations"
            aria-label={`重新选择 Organization：${organization.name}`}
            title={`Organization：${organization.name}`}
            className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--aios-control-border)] px-2.5 text-sm font-medium text-[var(--aios-text)] transition hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)] sm:px-3"
          >
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden truncate sm:inline">{organization.name}</span>
            <span className="sr-only sm:hidden">{organization.name}</span>
          </Link>
          <Link
            href="/workspaces"
            aria-label={`重新选择 Workspace：${workspace.name}`}
            title={`Workspace：${workspace.name}`}
            className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--aios-control-border)] px-2.5 text-sm font-medium text-[var(--aios-text)] transition hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)] sm:px-3"
          >
            <PanelsTopLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden max-w-40 truncate sm:inline">{workspace.name}</span>
            <span className="sr-only sm:hidden">{workspace.name}</span>
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span id="create-task-unavailable" className="sr-only">
          Task 功能将在对应实施阶段启用
        </span>
        <Button
          className="hidden sm:inline-flex"
          disabled
          aria-describedby="create-task-unavailable"
          title="Task 功能将在对应实施阶段启用"
        >
          <Plus size={17} aria-hidden="true" />
          创建 Task
        </Button>

        <span id="notifications-unavailable" className="sr-only">
          通知功能将在对应实施阶段启用
        </span>
        <button
          type="button"
          disabled
          className="grid size-11 place-items-center rounded-lg text-[var(--aios-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="通知（将在对应实施阶段启用）"
          aria-describedby="notifications-unavailable"
          title="通知功能将在对应实施阶段启用"
        >
          <Bell size={19} aria-hidden="true" />
        </button>

        <Link
          href="/login"
          aria-label={`切换身份：${user.name}，${user.role}`}
          title={`当前身份：${user.name}，${user.role}`}
          className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 text-left transition hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)] sm:px-2"
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--aios-canvas)] text-[var(--aios-muted)]"
            aria-hidden="true"
          >
            <UserRound size={17} />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold text-[var(--aios-text)]">
              {user.name}
            </span>
            <span className="block text-xs text-[var(--aios-muted)]">{user.role}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
