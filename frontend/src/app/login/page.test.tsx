import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { SessionProvider, useSession } from "@/features/session/session-provider";
import LoginPage from "./page";

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function SelectedUser() {
  const { user } = useSession();

  return <output aria-label="当前演示身份">{user?.name ?? "未选择"}</output>;
}

beforeEach(() => {
  push.mockReset();
});

test("renders all five mock identities with accessible selection buttons", () => {
  render(
    <SessionProvider>
      <LoginPage />
    </SessionProvider>,
  );

  expect(
    screen.getByRole("heading", { name: "选择演示身份" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/不是真实登录/)).toBeInTheDocument();

  for (const accessibleName of [
    "使用林悦（产品经理）身份",
    "使用周航（开发工程师）身份",
    "使用陈明（研发负责人）身份",
    "使用吴桐（工作空间管理员）身份",
    "使用赵岚（审计员）身份",
  ]) {
    expect(
      screen.getByRole("button", { name: accessibleName }),
    ).toBeInTheDocument();
  }
});

test("selects the identity before navigating to organizations", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <LoginPage />
      <SelectedUser />
    </SessionProvider>,
  );

  await interaction.click(
    screen.getByRole("button", { name: "使用陈明（研发负责人）身份" }),
  );

  expect(screen.getByRole("status", { name: "当前演示身份" })).toHaveTextContent(
    "陈明",
  );
  expect(push).toHaveBeenCalledWith("/organizations");
});
