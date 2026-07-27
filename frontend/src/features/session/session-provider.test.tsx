import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, expectTypeOf, test } from "vitest";

import type {
  DeepReadonly,
  OrganizationSummary,
  UserIdentity,
  WorkspaceSummary,
} from "@/types/domain";
import {
  MOCK_SESSION_STORAGE_KEY,
  SessionProvider,
  useSession,
} from "./session-provider";

function SessionHarness() {
  const {
    user,
    organization,
    workspace,
    hydrated,
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
          <dt>工作空间</dt>
          <dd>{workspace?.name ?? "未选择"}</dd>
        </div>
      </dl>

      <output aria-label="最近选择结果">
        {lastSelectionResult === undefined ? "尚未执行" : String(lastSelectionResult)}
      </output>
      <output aria-label="会话恢复状态">{hydrated ? "已恢复" : "恢复中"}</output>

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
        选择 AI 工作空间
      </button>
      <button onClick={() => setLastSelectionResult(selectUser("user-missing"))}>
        选择无效用户
      </button>
      <button onClick={() => setLastSelectionResult(selectOrganization("org-missing"))}>
        选择无效组织
      </button>
      <button onClick={() => setLastSelectionResult(selectWorkspace("ws-missing"))}>
        选择无效工作空间
      </button>
    </>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

test("selects the mock user, organization, and workspace in order", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));

  expect(screen.getByText("陈明")).toBeInTheDocument();
  expect(screen.getByText("光位科技")).toBeInTheDocument();
  expect(screen.getByText("AI 智能业务线")).toBeInTheDocument();
  expect(screen.getByLabelText("最近选择结果")).toHaveTextContent("true");
  expect(window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBe(
    JSON.stringify({
      userId: "user-lead",
      organizationId: "org-guangwei",
      workspaceId: "ws-ai",
    }),
  );
});

test("reselecting an organization clears the selected workspace", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));
  expect(screen.getByText("AI 智能业务线")).toBeInTheDocument();

  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  expect(screen.queryByText("AI 智能业务线")).not.toBeInTheDocument();
  expect(screen.getAllByText("未选择")).toHaveLength(1);
  expect(window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBe(
    JSON.stringify({
      userId: "user-lead",
      organizationId: "org-guangwei",
    }),
  );
});

test("returns false for unknown fixture IDs without replacing the current session", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));
  await interaction.click(screen.getByRole("button", { name: "选择无效用户" }));
  await interaction.click(screen.getByRole("button", { name: "选择无效组织" }));
  await interaction.click(screen.getByRole("button", { name: "选择无效工作空间" }));

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

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));
  await interaction.click(screen.getByRole("button", { name: "选择开发工程师" }));

  expect(screen.getByText("周航")).toBeInTheDocument();
  expect(screen.queryByText("光位科技")).not.toBeInTheDocument();
  expect(screen.queryByText("AI 智能业务线")).not.toBeInTheDocument();
  expect(screen.getAllByText("未选择")).toHaveLength(2);
  expect(window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBe(
    JSON.stringify({ userId: "user-dev" }),
  );
});

test("requires identity and organization before selecting a lower scope", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  expect(screen.getByLabelText("最近选择结果")).toHaveTextContent("false");
  expect(window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();

  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));
  expect(screen.getByLabelText("最近选择结果")).toHaveTextContent("false");
  expect(window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();

  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));
  expect(screen.getByLabelText("最近选择结果")).toHaveTextContent("false");
  expect(screen.queryByText("AI 智能业务线")).not.toBeInTheDocument();
});

test("restores a validated 标识-only session after remount", async () => {
  const interaction = userEvent.setup();
  const firstView = render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));
  firstView.unmount();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  expect(screen.getByText("陈明")).toBeInTheDocument();
  expect(screen.getByText("光位科技")).toBeInTheDocument();
  expect(screen.getByText("AI 智能业务线")).toBeInTheDocument();
});

describe.each([
  ["非法 JSON", "{"],
  ["未知用户", JSON.stringify({ userId: "user-unknown" })],
  [
    "工作空间缺少组织",
    JSON.stringify({ userId: "user-lead", workspaceId: "ws-ai" }),
  ],
  [
    "不一致的组织",
    JSON.stringify({
      userId: "user-lead",
      organizationId: "org-unknown",
      workspaceId: "ws-ai",
    }),
  ],
  [
    "不可访问的工作空间",
    JSON.stringify({
      userId: "user-lead",
      organizationId: "org-guangwei",
      workspaceId: "ws-archive-001",
    }),
  ],
  [
    "包含非白名单字段",
    JSON.stringify({ userId: "user-lead", role: "工作空间管理员" }),
  ],
])("invalid persisted session: %s", (_label, storedValue) => {
  test("clears the payload and restores an empty session", async () => {
    window.sessionStorage.setItem(MOCK_SESSION_STORAGE_KEY, storedValue);

    render(
      <SessionProvider>
        <SessionHarness />
      </SessionProvider>,
    );

    await screen.findByText("已恢复");
    expect(screen.getAllByText("未选择")).toHaveLength(3);
    expect(window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
  });
});

test("persists only stable fixture IDs and never names, roles, or credentials", async () => {
  const interaction = userEvent.setup();

  render(
    <SessionProvider>
      <SessionHarness />
    </SessionProvider>,
  );

  await screen.findByText("已恢复");
  await interaction.click(screen.getByRole("button", { name: "选择研发负责人" }));
  await interaction.click(screen.getByRole("button", { name: "选择光位科技" }));
  await interaction.click(screen.getByRole("button", { name: "选择 AI 工作空间" }));

  const storedValue = window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY);
  expect(storedValue).not.toBeNull();
  expect(storedValue).not.toMatch(/陈明|研发负责人|password|token|secret/i);
  expect(Object.keys(JSON.parse(storedValue!))).toEqual([
    "userId",
    "organizationId",
    "workspaceId",
  ]);
});

test("throws a clear error when useSession is called outside SessionProvider", () => {
  expect(() => render(<SessionHarness />)).toThrow(
    "useSession 必须在 SessionProvider 内部使用",
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
  expectTypeOf<PublicSession["hydrated"]>().toEqualTypeOf<boolean>();
  expectTypeOf<PublicSession["selectUser"]>().returns.toEqualTypeOf<boolean>();
  expectTypeOf<PublicSession["selectOrganization"]>().returns.toEqualTypeOf<boolean>();
  expectTypeOf<PublicSession["selectWorkspace"]>().returns.toEqualTypeOf<boolean>();
});
