"use client";

import { ArrowRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SessionRecoveryState } from "@/features/session/session-recovery-state";
import { useSession } from "@/features/session/session-provider";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { hydrated, organization, user, workspace } = useSession();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const pendingFocusTargetRef = useRef<"trigger" | "content" | null>(null);
  const navigationId = `${useId()}-main-navigation`;

  const closeMobileNavigation = useCallback(() => {
    pendingFocusTargetRef.current = "trigger";
    setMobileNavigationOpen(false);
  }, []);

  const finishMobileNavigation = useCallback(() => {
    pendingFocusTargetRef.current = "content";
    setMobileNavigationOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileNavigation();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeMobileNavigation, mobileNavigationOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const desktopMedia = window.matchMedia("(min-width: 768px)");

    function closeAtDesktopBreakpoint(event: Pick<MediaQueryListEvent, "matches">) {
      if (event.matches && mobileNavigationOpen) {
        finishMobileNavigation();
      }
    }

    desktopMedia.addEventListener("change", closeAtDesktopBreakpoint);
    closeAtDesktopBreakpoint(desktopMedia);

    return () => {
      desktopMedia.removeEventListener("change", closeAtDesktopBreakpoint);
    };
  }, [finishMobileNavigation, mobileNavigationOpen]);

  useEffect(() => {
    if (mobileNavigationOpen || !pendingFocusTargetRef.current) {
      return;
    }

    const focusTarget = pendingFocusTargetRef.current;
    pendingFocusTargetRef.current = null;

    if (focusTarget === "trigger") {
      navigationTriggerRef.current?.focus();
    } else {
      mainContentRef.current?.focus();
    }
  }, [mobileNavigationOpen]);

  if (!hydrated) {
    return <SessionRecoveryState />;
  }

  if (!user || !organization || !workspace) {
    const nextSelection = !user
      ? { href: "/login", label: "前往选择身份" }
      : !organization
        ? { href: "/organizations", label: "前往选择 Organization" }
        : { href: "/workspaces", label: "前往选择 Workspace" };

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--aios-canvas)] px-5 py-10">
        <Card className="w-full max-w-lg p-6 sm:p-8">
          <span
            className="grid size-12 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--aios-warning)_14%,var(--aios-surface))] text-[var(--aios-warning-foreground)]"
            aria-hidden="true"
          >
            <ShieldAlert size={23} />
          </span>
          <Badge className="mt-5" tone="warning">
            受保护工作范围
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold">尚未选择完整工作范围</h1>
          <p className="mt-3 leading-7 text-[var(--aios-muted)]">
            进入 AIOS 工作区需要依次确认用户身份、Organization 与 Workspace。
          </p>
          <Link
            href={nextSelection.href}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
          >
            {nextSelection.label}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--aios-canvas)]">
      {mobileNavigationOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 md:hidden"
          aria-label="关闭主导航遮罩"
          tabIndex={-1}
          onClick={closeMobileNavigation}
        />
      ) : null}

      <Sidebar
        navigationId={navigationId}
        open={mobileNavigationOpen}
        onClose={closeMobileNavigation}
        onNavigate={mobileNavigationOpen ? finishMobileNavigation : undefined}
      />

      <div
        data-testid="app-shell-background"
        className="min-w-0 flex-1"
        inert={mobileNavigationOpen ? true : undefined}
        aria-hidden={mobileNavigationOpen ? "true" : undefined}
      >
        <Topbar
          navigationId={navigationId}
          navigationOpen={mobileNavigationOpen}
          navigationTriggerRef={navigationTriggerRef}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
        />
        <main
          ref={mainContentRef}
          tabIndex={-1}
          className="p-5 focus:outline-none sm:p-6 lg:p-7 xl:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
