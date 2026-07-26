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
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  document.body.style.overflow = "";
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
  window.matchMedia = originalMatchMedia;
});

describe("AppShell", () => {
  it("shows recovery before guarding incomplete sessions without inventing a user or scope", async () => {
    render(
      <SessionProvider>
        <AppShell>
          <p>受保护内容</p>
        </AppShell>
      </SessionProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "正在恢复 Mock Session" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "尚未选择完整工作范围" }),
    ).toBeVisible();
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
    const dialog = screen.getByRole("dialog", { name: "AIOS 主导航" });
    const background = screen.getByTestId("app-shell-background");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(background).toHaveAttribute("inert");
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "关闭主导航" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await interaction.tab({ shift: true });
    expect(screen.getByRole("link", { name: "能力中心" })).toHaveFocus();
    await interaction.tab();
    expect(screen.getByRole("button", { name: "关闭主导航" })).toHaveFocus();

    await interaction.keyboard("{Escape}");

    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(openButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    expect(background).not.toHaveAttribute("inert");
    expect(background).not.toHaveAttribute("aria-hidden");
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

  it("closes the drawer and restores the page when its enabled link is selected", async () => {
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
    await interaction.click(screen.getByRole("link", { name: "工作台" }));

    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.getByTestId("app-shell-background")).not.toHaveAttribute("inert");
  });

  it("uses unique instance-scoped IDs for controls and descriptions", async () => {
    render(
      <>
        <CompleteSession>
          <AppShell>
            <p>第一个 Workspace</p>
          </AppShell>
        </CompleteSession>
        <CompleteSession>
          <AppShell>
            <p>第二个 Workspace</p>
          </AppShell>
        </CompleteSession>
      </>,
    );

    const openButtons = await screen.findAllByRole("button", { name: "打开主导航" });
    const navigationIds = openButtons.map((button) => button.getAttribute("aria-controls"));
    expect(new Set(navigationIds).size).toBe(2);
    for (const id of navigationIds) {
      expect(id).toBeTruthy();
      expect(document.getElementById(id!)).toBeInTheDocument();
    }

    const notificationButtons = screen.getAllByRole("button", {
      name: "通知（将在对应实施阶段启用）",
    });
    const notificationDescriptionIds = notificationButtons.map((button) =>
      button.getAttribute("aria-describedby"),
    );
    expect(new Set(notificationDescriptionIds).size).toBe(2);

    const taskLinks = screen.getAllByRole("link", { name: "Task" });
    expect(taskLinks).toHaveLength(2);
    for (const taskLink of taskLinks) {
      expect(taskLink).toHaveAttribute("href", "/tasks");
      expect(taskLink).not.toHaveAttribute("aria-describedby");
    }

    for (const id of notificationDescriptionIds) {
      expect(id).toBeTruthy();
      expect(document.getElementById(id!)).toBeInTheDocument();
    }
  });

  it("cleans listeners, scroll lock, and isolated background state on unmount", async () => {
    const interaction = userEvent.setup();
    document.body.style.overflow = "clip";

    const { unmount } = render(
      <CompleteSession>
        <AppShell>
          <p>Workspace 内容</p>
        </AppShell>
      </CompleteSession>,
    );

    const openButton = await screen.findByRole("button", { name: "打开主导航" });
    await interaction.click(openButton);
    const background = screen.getByTestId("app-shell-background");

    expect(document.body.style.overflow).toBe("hidden");
    expect(background).toHaveAttribute("inert");
    expect(desktopMediaListeners.size).toBe(1);

    unmount();

    expect(document.body.style.overflow).toBe("clip");
    expect(desktopMediaListeners.size).toBe(0);
    expect(document.body).not.toContainElement(background);

    document.body.style.overflow = "";
  });
});
