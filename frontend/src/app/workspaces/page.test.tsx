import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { SessionProvider, useSession } from "@/features/session/session-provider";
import WorkspacesPage from "./page";

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function WorkspaceTestControls() {
  const { workspace, selectUser, selectOrganization } = useSession();

  return (
    <>
      <button onClick={() => selectUser("user-lead")}>建立演示身份</button>
      <button onClick={() => selectOrganization("org-guangwei")}>建立组织范围</button>
      <output aria-label="当前 Workspace">{workspace?.name ?? "未选择"}</output>
    </>
  );
}

beforeEach(() => {
  push.mockReset();
});

test("offers the correct fallback while identity and organization are missing", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <WorkspaceTestControls />
      <WorkspacesPage />
    </SessionProvider>,
  );

  expect(
    screen.getByRole("heading", { name: "正在恢复 Mock Session" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "请先选择身份" }),
  ).not.toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "返回身份选择" })).toHaveAttribute(
    "href",
    "/login",
  );

  await interaction.click(screen.getByRole("button", { name: "建立演示身份" }));

  expect(
    screen.getByRole("link", { name: "返回 Organization 选择" }),
  ).toHaveAttribute("href", "/organizations");
});

test("restores identity and Organization without flashing a scope error", async () => {
  window.sessionStorage.setItem(
    "aios.mock.session.v1",
    JSON.stringify({
      userId: "user-lead",
      organizationId: "org-guangwei",
    }),
  );

  render(
    <SessionProvider>
      <WorkspacesPage />
    </SessionProvider>,
  );

  expect(
    screen.getByRole("heading", { name: "正在恢复 Mock Session" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: /请先选择/ }),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "选择 Workspace" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: /请先选择/ }),
  ).not.toBeInTheDocument();
});

test("updates the workspace before navigating to the workspace home", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <WorkspaceTestControls />
      <WorkspacesPage />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "建立演示身份" }));
  await interaction.click(screen.getByRole("button", { name: "建立组织范围" }));
  await interaction.click(
    screen.getByRole("button", { name: "选择 Workspace AI 智能业务线" }),
  );

  expect(screen.getByLabelText("当前 Workspace")).toHaveTextContent("AI 智能业务线");
  expect(push).toHaveBeenCalledWith("/workspace");
});

test("shows accessible and archived Workspace scope information", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <WorkspaceTestControls />
      <WorkspacesPage />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "建立演示身份" }));
  await interaction.click(screen.getByRole("button", { name: "建立组织范围" }));

  expect(screen.getByText("ws-ai")).toBeVisible();
  expect(screen.getByText("建设并验证企业 AI 研发员工")).toBeVisible();
  expect(screen.getAllByText("当前职责：研发负责人")).toHaveLength(2);
  expect(screen.getByText("最近进入：2026-07-25 09:12")).toBeVisible();
  expect(screen.getByText("历史研发试验区")).toBeVisible();
  expect(screen.getByText("ws-archive-001")).toBeVisible();
  const accessBadge = screen.getByText("可访问", { selector: "span" });
  const archivedBadge = screen.getByText("已归档", { selector: "span" });
  expect(accessBadge).toBeVisible();
  expect(archivedBadge).toBeVisible();
  expect(accessBadge.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  expect(archivedBadge.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  expect(
    screen.getByText("该 Workspace 已归档，仅可查看范围信息"),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Workspace 历史研发试验区 不可进入" }),
  ).toBeDisabled();
});
