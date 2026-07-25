import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { SessionProvider, useSession } from "@/features/session/session-provider";
import OrganizationsPage from "./page";

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function OrganizationTestControls() {
  const { organization, selectUser } = useSession();

  return (
    <>
      <button onClick={() => selectUser("user-lead")}>建立演示身份</button>
      <output aria-label="当前 Organization">{organization?.name ?? "未选择"}</output>
    </>
  );
}

beforeEach(() => {
  push.mockReset();
});

test("offers a login fallback when no identity has been selected", () => {
  render(
    <SessionProvider>
      <OrganizationsPage />
    </SessionProvider>,
  );

  expect(screen.getByRole("heading", { name: "请先选择身份" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回身份选择" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("updates the organization before navigating to workspaces", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <OrganizationTestControls />
      <OrganizationsPage />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "建立演示身份" }));
  await interaction.click(screen.getByRole("button", { name: "选择组织 光位科技" }));

  expect(screen.getByLabelText("当前 Organization")).toHaveTextContent("光位科技");
  expect(push).toHaveBeenCalledWith("/workspaces");
});

test("shows the approved Organization scope information", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <OrganizationTestControls />
      <OrganizationsPage />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "建立演示身份" }));

  expect(screen.getByText("org-guangwei")).toBeVisible();
  expect(screen.getByText("管理光位科技企业 AI 资源与工作范围")).toBeVisible();
  expect(screen.getByText("当前职责：研发负责人")).toBeVisible();
  expect(screen.getByText("可访问 Workspace：1")).toBeVisible();
  expect(screen.getByText("最近进入：2026-07-24 18:30")).toBeVisible();
  expect(screen.getByText("可访问", { selector: "span" })).toBeVisible();
});
