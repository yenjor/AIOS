import { render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import {
  SessionProvider,
  useSession,
} from "@/features/session/session-provider";
import { workspaceDashboard } from "@/mock/fixtures";

import { DashboardScreen } from "./dashboard-screen";

function DashboardHarness({ userId = "user-lead" }: { userId?: string }) {
  const { selectUser } = useSession();

  useEffect(() => {
    selectUser(userId);
  }, [selectUser, userId]);

  return <DashboardScreen snapshot={workspaceDashboard} />;
}

function renderDashboard(userId = "user-lead") {
  return render(
    <SessionProvider>
      <DashboardHarness userId={userId} />
    </SessionProvider>,
  );
}

describe("DashboardScreen", () => {
  it("summarizes the current responsibility and exact Workspace metrics", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Workspace 工作台" }),
    ).toBeVisible();
    expect(screen.getByText("当前职责：研发负责人")).toBeVisible();

    const expectedMetrics = [
      ["我的待办", "5"],
      ["进行中 Task", "12"],
      ["可用 AI 员工", "1"],
      ["待验收 Artifact", "3"],
    ];

    for (const [label, value] of expectedMetrics) {
      const metric = screen.getByRole("group", { name: label });
      expect(within(metric).getByText(value)).toBeVisible();
    }
  });

  it("shows the role from the active session instead of the dashboard fixture", () => {
    renderDashboard("user-pm");

    expect(screen.getByText("当前职责：产品经理")).toBeVisible();
    expect(screen.queryByText("当前职责：研发负责人")).not.toBeInTheDocument();
  });

  it("shows the AI employee owner, state, autonomy, and output statistics", () => {
    renderDashboard();

    const agent = screen.getByRole("region", { name: "AI 研发员工" });

    expect(
      within(agent).getByRole("heading", { name: "AI 研发员工" }),
    ).toBeVisible();
    const agentStatus = within(agent).getByText("运行中", { selector: "span" });
    expect(agentStatus).toBeVisible();
    expect(agentStatus.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
    expect(within(agent).getByText("责任人：陈明")).toBeVisible();
    expect(within(agent).getByText("自治等级：L1 辅助")).toBeVisible();

    for (const [label, value] of [
      ["今日完成", "8"],
      ["运行中", "5"],
      ["累计 Artifact", "32"],
    ]) {
      const statistic = within(agent).getByRole("group", { name: label });
      const term = within(statistic).getByText(label);
      const description = within(statistic).getByText(value);

      expect(term.tagName).toBe("DT");
      expect(description.tagName).toBe("DD");
      expect(term.nextElementSibling).toBe(description);
      expect(description).toBeVisible();
    }
  });

  it("renders six disabled Task shortcuts with an accessible rollout explanation", () => {
    renderDashboard();

    const quickActions = screen.getByRole("region", { name: "快速创建" });
    const buttons = within(quickActions).getAllByRole("button");

    expect(buttons).toHaveLength(6);
    for (const [button, label] of buttons.map(
      (button, index) =>
        [button, workspaceDashboard.quickActions[index].label] as const,
    )) {
      expect(button).toHaveTextContent(label);
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleName(
        `${label}：将在 Task 创建流程实施阶段启用`,
      );
    }
  });

  it("renders the recent Task table, Artifact todos, and risk list", () => {
    renderDashboard();

    const taskTable = screen.getByRole("table", { name: "最近 Task 列表" });
    expect(within(taskTable).getAllByRole("row")).toHaveLength(5);

    for (const heading of ["Task", "类型", "AI 员工", "状态", "更新时间"]) {
      expect(
        within(taskTable).getByRole("columnheader", { name: heading }),
      ).toBeVisible();
    }

    for (const task of workspaceDashboard.tasks) {
      const row = within(taskTable).getByRole("row", { name: new RegExp(task.title) });
      expect(within(row).getByText(task.type)).toBeVisible();
      expect(within(row).getByText(task.status)).toBeVisible();
      expect(
        within(row).getByText(task.status).querySelector("svg[aria-hidden='true']"),
      ).toBeInTheDocument();
    }

    const todos = screen.getByRole("region", { name: "我的待办" });
    expect(within(todos).getAllByRole("listitem")).toHaveLength(3);
    expect(within(todos).getByText("当前显示 3 项，共 5 项")).toBeVisible();
    for (const todo of workspaceDashboard.todos) {
      expect(within(todos).getByText(todo.artifactType)).toBeVisible();
    }

    const risks = screen.getByRole("region", { name: "风险提示" });
    expect(within(risks).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(risks).getByRole("listitem", { name: "警告风险：需求澄清不足" }),
    ).toBeVisible();
    expect(
      within(risks).getByRole("listitem", { name: "错误风险：Task 超期" }),
    ).toBeVisible();
  });

  it("renders explicit empty states for Task, todo, and risk collections", () => {
    const emptySnapshot = {
      ...workspaceDashboard,
      tasks: [],
      todos: [],
      risks: [],
    };

    render(
      <SessionProvider>
        <DashboardScreen snapshot={emptySnapshot} />
      </SessionProvider>,
    );

    expect(screen.getByText("暂无最近 Task")).toBeVisible();
    expect(screen.getByText("暂无待办")).toBeVisible();
    expect(screen.getByText("暂无风险提示")).toBeVisible();
  });

  it("shows a visible read-only rollout explanation", () => {
    renderDashboard();

    expect(
      screen.getByText("当前为只读演示，Task 创建与处理尚未启用。"),
    ).toBeVisible();
  });

  it("keeps every future action inert and does not expose a chat input", () => {
    renderDashboard();

    const futureActions = screen.getAllByRole("button");
    expect(futureActions).toHaveLength(11);
    for (const action of futureActions) {
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleName(/将在 .+实施阶段启用/);
    }

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/聊天|消息|提问/)).not.toBeInTheDocument();
  });

  it("keeps multiple dashboard instances free of duplicate IDs and explains every future action", () => {
    const view = render(
      <SessionProvider>
        <div data-testid="dashboard-one">
          <DashboardHarness />
        </div>
        <div data-testid="dashboard-two">
          <DashboardHarness />
        </div>
      </SessionProvider>,
    );

    const ids = Array.from(view.container.querySelectorAll("[id]"), (element) =>
      element.getAttribute("id"),
    );
    expect(new Set(ids).size).toBe(ids.length);

    for (const testId of ["dashboard-one", "dashboard-two"]) {
      const dashboard = within(screen.getByTestId(testId));
      const futureActions = dashboard.getAllByRole("button");

      expect(futureActions).toHaveLength(11);
      for (const action of futureActions) {
        expect(action).toBeDisabled();
        expect(action).toHaveAccessibleName(/将在 .+实施阶段启用/);
      }
    }
  });

  it("accepts the canonical readonly fixture without modifying it", () => {
    const beforeRender = JSON.stringify(workspaceDashboard);

    renderDashboard();

    expect(JSON.stringify(workspaceDashboard)).toBe(beforeRender);
    expect(Object.isFrozen(workspaceDashboard)).toBe(true);
    expect(Object.isFrozen(workspaceDashboard.tasks)).toBe(true);
  });
});
