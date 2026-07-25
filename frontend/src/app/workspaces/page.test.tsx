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

  expect(screen.getByRole("link", { name: "返回身份选择" })).toHaveAttribute(
    "href",
    "/login",
  );

  await interaction.click(screen.getByRole("button", { name: "建立演示身份" }));

  expect(
    screen.getByRole("link", { name: "返回 Organization 选择" }),
  ).toHaveAttribute("href", "/organizations");
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
