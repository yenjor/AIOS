import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionProvider, useSession } from "@/features/session/session-provider";
import { organization, workspace } from "@/mock/fixtures";

import { Topbar } from "./topbar";

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

describe("Topbar", () => {
  it("shows the real selected scope and identity with correct selection links", async () => {
    render(
      <CompleteSession>
        <Topbar
          navigationId="test-navigation"
          onOpenNavigation={vi.fn()}
          navigationOpen={false}
        />
      </CompleteSession>,
    );

    expect(
      await screen.findByRole("link", {
        name: `重新选择 Organization：${organization.name}`,
      }),
    ).toHaveAttribute("href", "/organizations");
    expect(
      screen.getByRole("link", {
        name: `重新选择 Workspace：${workspace.name}`,
      }),
    ).toHaveAttribute("href", "/workspaces");
    expect(
      screen.getByRole("link", { name: "切换身份：陈明，研发负责人" }),
    ).toHaveAttribute("href", "/login");
  });

  it("keeps future actions disabled with accessible explanations", async () => {
    render(
      <CompleteSession>
        <Topbar
          navigationId="test-navigation"
          onOpenNavigation={vi.fn()}
          navigationOpen={false}
        />
      </CompleteSession>,
    );

    const createTask = await screen.findByRole("button", { name: "创建 Task" });
    const notifications = screen.getByRole("button", {
      name: "通知（将在对应实施阶段启用）",
    });

    expect(createTask).toBeDisabled();
    expect(createTask).toHaveAccessibleDescription("Task 功能将在对应实施阶段启用");
    expect(notifications).toBeDisabled();
    expect(notifications).toHaveAccessibleDescription(
      "通知功能将在对应实施阶段启用",
    );
  });

  it("opens the mobile navigation from an explicitly labelled control", async () => {
    const interaction = userEvent.setup();
    const onOpenNavigation = vi.fn();

    render(
      <CompleteSession>
        <Topbar
          navigationId="test-navigation"
          onOpenNavigation={onOpenNavigation}
          navigationOpen={false}
        />
      </CompleteSession>,
    );

    const openButton = await screen.findByRole("button", { name: "打开主导航" });
    expect(openButton).toHaveAttribute("aria-controls", "test-navigation");
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    await interaction.click(openButton);
    expect(onOpenNavigation).toHaveBeenCalledOnce();
  });
});
