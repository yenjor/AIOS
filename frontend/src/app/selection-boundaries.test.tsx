import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import LoginPage from "./login/page";
import OrganizationsPage from "./organizations/page";
import WorkspacesPage from "./workspaces/page";

const { push, useSession } = vi.hoisted(() => ({
  push: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/session/session-provider", () => ({
  useSession,
}));

beforeEach(() => {
  push.mockReset();
  useSession.mockReset();
});

test("login does not navigate when identity selection fails", async () => {
  const interaction = userEvent.setup();
  useSession.mockReturnValue({ hydrated: true, selectUser: vi.fn(() => false) });

  render(<LoginPage />);

  await interaction.click(
    screen.getByRole("button", { name: "使用陈明（研发负责人）身份" }),
  );

  expect(push).not.toHaveBeenCalled();
});

test("organization selection failure does not navigate", async () => {
  const interaction = userEvent.setup();
  useSession.mockReturnValue({
    hydrated: true,
    user: { id: "user-lead", name: "陈明", role: "研发负责人" },
    selectOrganization: vi.fn(() => false),
  });

  render(<OrganizationsPage />);

  await interaction.click(screen.getByRole("button", { name: "选择组织光位科技" }));

  expect(push).not.toHaveBeenCalled();
});

test("workspace selection failure does not navigate", async () => {
  const interaction = userEvent.setup();
  useSession.mockReturnValue({
    hydrated: true,
    user: { id: "user-lead", name: "陈明", role: "研发负责人" },
    organization: { id: "org-guangwei", name: "光位科技" },
    selectWorkspace: vi.fn(() => false),
  });

  render(<WorkspacesPage />);

  await interaction.click(
    screen.getByRole("button", { name: "选择工作空间 AI 智能业务线" }),
  );

  expect(push).not.toHaveBeenCalled();
});
