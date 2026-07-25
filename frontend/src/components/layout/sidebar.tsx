"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import { navigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

export interface SidebarProps {
  navigationId?: string;
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

const unavailableExplanation = "将在对应实施阶段启用";

export function Sidebar({
  navigationId,
  open,
  onClose,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const generatedId = useId();
  const resolvedNavigationId = navigationId ?? `${generatedId}-main-navigation`;
  const unavailableDescriptionBaseId = `${generatedId}-unavailable`;

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  function keepFocusInsideMobileDrawer(event: KeyboardEvent<HTMLElement>) {
    if (!open || event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handleEnabledNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    active: boolean,
  ) {
    onNavigate?.();

    if (active) {
      event.preventDefault();
    }
  }

  return (
    <aside
      ref={sidebarRef}
      id={resolvedNavigationId}
      role={open ? "dialog" : undefined}
      aria-modal={open ? "true" : undefined}
      aria-label="AIOS 主导航"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col overflow-y-auto bg-[var(--aios-navigation)] px-4 py-5 text-white shadow-2xl transition-transform duration-200",
        open ? "visible translate-x-0" : "invisible -translate-x-full",
        "md:visible md:static md:z-auto md:w-[72px] md:translate-x-0 md:shadow-none",
        "xl:w-[248px]",
      )}
      onKeyDown={keepFocusInsideMobileDrawer}
    >
      <div className="flex min-h-11 items-start justify-between gap-3 px-2 md:justify-center md:px-0 xl:justify-between xl:px-2">
        <div className="min-w-0">
          <div
            role="img"
            aria-label="AIOS"
            data-testid="sidebar-brand"
            className="text-2xl font-bold tracking-tight md:text-center xl:text-left"
          >
            <span aria-hidden="true" className="md:hidden xl:inline">
              AIOS
            </span>
            <span aria-hidden="true" className="hidden md:inline xl:hidden">
              A
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 md:hidden xl:block">
            企业 AI 工作操作系统
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white md:hidden"
          aria-label="关闭主导航"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <nav className="mt-7 space-y-6" aria-label="主要导航">
        {navigation.map((group, groupIndex) => (
          <section key={group.label}>
            <h2 className="px-2 text-xs font-medium text-slate-400 md:sr-only xl:not-sr-only xl:px-2">
              {group.label}
            </h2>
            <ul className="mt-2 space-y-1">
              {group.items.map((item, itemIndex) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                const unavailableDescriptionId =
                  `${unavailableDescriptionBaseId}-${groupIndex}-${itemIndex}`;
                const itemContent = (
                  <>
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      <span className="truncate md:hidden xl:inline">{item.label}</span>
                      {item.badge ? (
                        <span className="sr-only">，{item.badge} 项待处理</span>
                      ) : null}
                    </span>
                    {item.badge ? (
                      <span
                        className={cn(
                          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold md:absolute md:right-0 md:top-0 md:min-w-5 md:-translate-y-1/3 xl:static xl:translate-y-0",
                          item.enabled
                            ? "bg-[var(--aios-error)] text-white"
                            : "bg-slate-700 text-slate-200",
                        )}
                        aria-hidden="true"
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                );

                return (
                  <li key={item.href}>
                    {item.enabled ? (
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        aria-current={active ? "page" : undefined}
                        title={item.label}
                        onClick={(event) => handleEnabledNavigation(event, active)}
                        className={cn(
                          "relative flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white",
                          "md:justify-center md:px-0 xl:justify-between xl:px-3",
                          active && "bg-[var(--aios-primary)] text-white",
                        )}
                      >
                        {itemContent}
                      </Link>
                    ) : (
                      <>
                        <span
                          role="link"
                          className="relative flex min-h-11 cursor-not-allowed items-center justify-between rounded-lg px-3 text-sm font-medium text-slate-500 md:justify-center md:px-0 xl:justify-between xl:px-3"
                          aria-disabled="true"
                          aria-describedby={unavailableDescriptionId}
                          title={`${item.label}：${unavailableExplanation}`}
                        >
                          {itemContent}
                        </span>
                        <span id={unavailableDescriptionId} className="sr-only">
                          {unavailableExplanation}
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
