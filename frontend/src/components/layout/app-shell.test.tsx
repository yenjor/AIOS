import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider, useSession } from "@/features/session/session-provider";
import { organization, workspace } from "@/mock/fixtures";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
}));

const desktopMediaListeners = new Set<(event: MediaQueryListEvent) => void>();
let desktopMediaMatches = false;

beforeEach(() => {
  desktopMediaMatches = false;
  desktopMediaListeners.clear();
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return desktopMediaMatches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      desktopMediaListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      desktopMediaListeners.delete(listener);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
});

function CompleteSession({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionBootstrap />
      {children}
    </SessionProvider>
  );
}

function SessionBootstrap() {
  const { selectOrganization, selectUser, selectWorkspace } = useSession();

  useEffect(() => {
    selectUser("user-lead");
    selectOrganization(organization.id);
    selectWorkspace(workspace.id);
  }, [selectOrganization, selectUser, selectWorkspace]);

  return null;
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("AppShell", () => {
  it("guards incomplete sessions without inventing a user or scope", () => {
    render(
      <SessionProvider>
        <AppShell>
          <p>受保护内容</p>
        </AppShell>
      </SessionProvider>,
    );

    expect(screen.getByRole("heading", { name: "尚未选择完整工作范围" })).toBeVisible();
    expect(screen.getByRole("link", { name: "前往选择身份" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByText("受保护内容")).not.toBeInTheDocument();
    expect(screen.queryByText("陈明")).not.toBeInTheDocument();
    expect(screen.queryByText("光位科技")).not.toBeInTheDocument();
  });

  it("opens and closes the mobile drawer with Escape and restores trigger focus", async () => {
    const interaction = userEvent.setup();

    render(
      <CompleteSession>
        <AppShell>
          <p>Workspace 内容</p>
        </AppShell>
      </CompleteSession>,
    );

    const openButton = await screen.findByRole("button", { name: "打开主导航" });
    await interaction.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "关闭主导航" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await interaction.tab({ shift: true });
    expect(screen.getByRole("link", { name: "工作台" })).toHaveFocus();
    await interaction.tab();
    expect(screen.getByRole("button", { name: "关闭主导航" })).toHaveFocus();

    await interaction.keyboard("{Escape}");

    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(openButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the mobile drawer from its overlay and close button", async () => {
    const interaction = userEvent.setup();

    render(
      <CompleteSession>
        <AppShell>
          <p>Workspace 内容</p>
        </AppShell>
      </CompleteSession>,
    );

    const openButton = await screen.findByRole("button", { name: "打开主导航" });

    await interaction.click(openButton);
    await interaction.click(screen.getByRole("button", { name: "关闭主导航遮罩" }));
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(openButton).toHaveFocus();

    await interaction.click(openButton);
    await interaction.click(screen.getByRole("button", { name: "关闭主导航" }));
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(openButton).toHaveFocus();
  });

  it("resets mobile-only state when the viewport crosses into the md breakpoint", async () => {
    const interaction = userEvent.setup();

    render(
      <CompleteSession>
        <AppShell>
          <p>Workspace 内容</p>
        </AppShell>
      </CompleteSession>,
    );

    const openButton = await screen.findByRole("button", { name: "打开主导航" });
    await interaction.click(openButton);
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      desktopMediaMatches = true;
      for (const listener of desktopMediaListeners) {
        listener({ matches: true, media: "(min-width: 768px)" } as MediaQueryListEvent);
      }
    });

    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    expect(openButton).not.toHaveFocus();
    expect(screen.getByRole("main")).toHaveFocus();

    const workspaceLink = screen.getByRole("link", { name: "工作台" });
    workspaceLink.focus();
    expect(fireEvent.keyDown(workspaceLink, { key: "Tab" })).toBe(true);
  });
});
