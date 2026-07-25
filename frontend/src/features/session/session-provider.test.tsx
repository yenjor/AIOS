import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, expectTypeOf, test } from "vitest";

import type {
  DeepReadonly,
  OrganizationSummary,
  UserIdentity,
  WorkspaceSummary,
} from "@/types/domain";
import { SessionProvider, useSession } from "./session-provider";

function SessionHarness() {
  const {
    user,
    organization,
    workspace,
    selectUser,
    selectOrganization,
    selectWorkspace,
  } = useSession();
  const [lastSelectionResult, setLastSelectionResult] = useState<boolean>();

  return (
    <>
      <dl>
        <div>
          <dt>用户</dt>
          <dd>{user?.name ?? "未选择"}</dd>
        </div>
        <div>
          <dt>组织</dt>
          <dd>{organization?.name ?? "未选择"}</dd>
        </div>
        <div>
          <dt>Workspace</dt>
          <dd>{workspace?.name ?? "未选择"}</dd>
        </div>
      </dl>

      <output aria-label="最近选择结果">
        {lastSelectionResult === undefined ? "尚未执行" : String(lastSelectionResult)}
      </output>

      <button onClick={() => setLastSelectionResult(selectUser("user-lead"))}>
        选择研发负责人
      </button>
      <button onClick={() => setLastSelectionResult(selectUser("user-dev"))}>
        选择开发工程师
      </button>
      <button onClick={() => setLastSelectionResult(selectOrganization("org-guangwei"))}>
        选择光位科技
      </button>
      <button onClick={() => setLastSelectionResult(selectWorkspace("ws-ai"))}>
        选择 AI Workspace
      </button>
      <button onClick={() => setLastSelectionResult(selectUser("user-missing"))}>
        选择无效用户
      </button>
      <button onClick={() => setLastSelectionResult(selectOrganization("org-missing"))}>
        选择无效组织
      </button>
      <button onClick={() => setLastSelectionResult(selectWorkspace("ws-missing"))}>
        选择无效 Workspace
      </button>
    </>
  );
}

test("selects the mock user, organization, and workspace in order", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI Workspace" }));

  expect(screen.getByText("陈明")).toBeInTheDocument();
  expect(screen.getByText("光位科技")).toBeInTheDocument();
  expect(screen.getByText("AI 智能业务线")).toBeInTheDocument();
  expect(screen.getByLabelText("最近选择结果")).toHaveTextContent("true");
});

test("reselecting an organization clears the selected workspace", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI Workspace" }));
  expect(screen.getByText("AI 智能业务线")).toBeInTheDocument();

  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  expect(screen.queryByText("AI 智能业务线")).not.toBeInTheDocument();
  expect(screen.getAllByText("未选择")).toHaveLength(2);
});

test("returns false for unknown fixture IDs without replacing the current session", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI Workspace" }));
  await interaction.click(screen.getByRole("button", { name: "选择无效用户" }));
  await interaction.click(screen.getByRole("button", { name: "选择无效组织" }));
  await interaction.click(screen.getByRole("button", { name: "选择无效 Workspace" }));

  expect(screen.getByText("陈明")).toBeInTheDocument();
  expect(screen.getByText("光位科技")).toBeInTheDocument();
  expect(screen.getByText("AI 智能业务线")).toBeInTheDocument();
  expect(screen.getByLabelText("最近选择结果")).toHaveTextContent("false");
});

test("clears organization and workspace scope after switching identity", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI Workspace" }));
  await interaction.click(screen.getByRole("button", { name: "选择开发工程师" }));

  expect(screen.getByText("周航")).toBeInTheDocument();
  expect(screen.queryByText("光位科技")).not.toBeInTheDocument();
  expect(screen.queryByText("AI 智能业务线")).not.toBeInTheDocument();
  expect(screen.getAllByText("未选择")).toHaveLength(2);
});

test("throws a clear error when useSession is called outside SessionProvider", () => {
  expect(() => render(<SessionHarness />)).toThrow(
    "useSession must be used within a SessionProvider",
  );
});

test("exposes selected session entities as deeply readonly values", () => {
  type PublicSession = ReturnType<typeof useSession>;

  expectTypeOf<PublicSession["user"]>().toEqualTypeOf<
    DeepReadonly<UserIdentity> | undefined
  >();
  expectTypeOf<PublicSession["organization"]>().toEqualTypeOf<
    DeepReadonly<OrganizationSummary> | undefined
  >();
  expectTypeOf<PublicSession["workspace"]>().toEqualTypeOf<
    DeepReadonly<WorkspaceSummary> | undefined
  >();
  expectTypeOf<PublicSession["selectUser"]>().returns.toEqualTypeOf<boolean>();
  expectTypeOf<PublicSession["selectOrganization"]>().returns.toEqualTypeOf<boolean>();
  expectTypeOf<PublicSession["selectWorkspace"]>().returns.toEqualTypeOf<boolean>();
});
