import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionProvider, useSession } from "@/features/session/session-provider";
import { organization, workspace } from "@/mock/fixtures";

import { Topbar } from "./topbar";

function CompleteSession({
  children,
  userId = "user-lead",
}: {
  children: ReactNode;
  userId?: string;
}) {
  return (
    <SessionProvider>
      <SessionBootstrap userId={userId} />
      {children}
    </SessionProvider>
  );
}

function SessionBootstrap({ userId }: { userId: string }) {
  const { selectOrganization, selectUser, selectWorkspace } = useSession();

  useEffect(() => {
    selectUser(userId);
    selectOrganization(organization.id);
    selectWorkspace(workspace.id);
  }, [selectOrganization, selectUser, selectWorkspace, userId]);

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

  it("enables Task creation from repository permission while keeping notifications disabled", async () => {
    render(
      <CompleteSession>
        <Topbar
          navigationId="test-navigation"
          onOpenNavigation={vi.fn()}
          navigationOpen={false}
        />
      </CompleteSession>,
    );

    const createTask = await screen.findByRole("link", { name: "创建 Task" });
    const notifications = screen.getByRole("button", {
      name: "通知（将在对应实施阶段启用）",
    });

    expect(createTask).toHaveAttribute("href", "/tasks/new");
    expect(notifications).toBeDisabled();
    expect(notifications).toHaveAccessibleDescription(
      "通知功能将在对应实施阶段启用",
    );
    expect(screen.getByText("Mock Repository · Workspace 隔离")).toBeVisible();
    expect(screen.queryByText("只读演示 · 功能未启用")).not.toBeInTheDocument();
  });

  it("does not render Task creation for Auditor", async () => {
    render(
      <CompleteSession userId="user-auditor">
        <Topbar
          navigationId="test-navigation"
          onOpenNavigation={vi.fn()}
          navigationOpen={false}
        />
      </CompleteSession>,
    );

    expect(
      await screen.findByRole("link", {
        name: "切换身份：赵岚，Auditor",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "创建 Task" }),
    ).not.toBeInTheDocument();
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
