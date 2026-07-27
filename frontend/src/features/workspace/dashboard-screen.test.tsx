import { render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import {
  SessionProvider,
  useSession,
} from "@/features/session/session-provider";
import { organization, workspace, workspaceDashboard } from "@/mock/fixtures";
import {
  TASK_STATUS_LABELS,
  TASK_TEMPLATE_NAMES,
} from "@/features/task/task-status";

import { DashboardScreen } from "./dashboard-screen";

function DashboardHarness({ userId = "user-lead" }: { userId?: string }) {
  const { selectOrganization, selectUser, selectWorkspace } = useSession();

  useEffect(() => {
    selectUser(userId);
    selectOrganization(organization.id);
    selectWorkspace(workspace.id);
  }, [selectOrganization, selectUser, selectWorkspace, userId]);

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
  it("summarizes the current responsibility and exact 工作空间 metrics", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "工作空间工作台" }),
    ).toBeVisible();
    expect(screen.getByText("当前职责：研发负责人")).toBeVisible();

    const expectedMetrics = [
      ["我的待办", "5"],
      ["进行中任务", "12"],
      ["可用 AI 员工", "1"],
      ["待验收成果", "3"],
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
      ["累计成果", "32"],
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

  it("renders six canonical 任务 template links when creation is allowed", async () => {
    renderDashboard();

    const quickActions = await screen.findByRole("region", { name: "快速创建" });
    const links = await within(quickActions).findAllByRole("link");

    expect(links).toHaveLength(6);
    expect(workspaceDashboard.quickActions.map(({ label }) => label)).toEqual(
      TASK_TEMPLATE_NAMES,
    );
    for (const [link, label] of links.map(
      (link, index) =>
        [link, workspaceDashboard.quickActions[index].label] as const,
    )) {
      expect(link).toHaveTextContent(label);
      expect(link).toHaveAttribute("href", "/tasks/new");
    }
  });

  it("renders canonical recent 任务 links, 成果 todos, and risk list", () => {
    renderDashboard();

    const taskTable = screen.getByRole("table", { name: "最近任务列表" });
    expect(within(taskTable).getAllByRole("row")).toHaveLength(5);

    for (const heading of ["任务", "模板", "AI 员工", "状态", "更新时间"]) {
      expect(
        within(taskTable).getByRole("columnheader", { name: heading }),
      ).toBeVisible();
    }

    for (const task of workspaceDashboard.tasks) {
      const row = within(taskTable).getByRole("row", {
        name: new RegExp(task.id),
      });
      expect(within(row).getByText(task.templateName)).toBeVisible();
      expect(within(row).getByText(TASK_STATUS_LABELS[task.status])).toBeVisible();
      expect(
        within(row)
          .getByText(TASK_STATUS_LABELS[task.status])
          .closest("[data-task-status]"),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("link", { name: `查看任务 ${task.id}` }),
      ).toHaveAttribute("href", `/tasks/${task.id}`);
    }
    expect(screen.getByRole("link", { name: "查看全部任务" })).toHaveAttribute(
      "href",
      "/tasks",
    );

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
      within(risks).getByRole("listitem", { name: "错误风险：任务超期" }),
    ).toBeVisible();
  });

  it("renders explicit empty states for 任务, todo, and risk collections", () => {
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

    expect(screen.getByText("暂无最近任务")).toBeVisible();
    expect(screen.getByText("暂无待办")).toBeVisible();
    expect(screen.getByText("暂无风险提示")).toBeVisible();
  });

  it("shows the truthful 本地演示数据 experience explanation", () => {
    renderDashboard();

    expect(
      screen.getByText("任务列表、创建向导与只读详情已接入本地演示数据。"),
    ).toBeVisible();
  });

  it("keeps only future 成果 actions inert and does not expose a chat input", async () => {
    renderDashboard();

    await screen.findByRole("link", { name: "创建任务" });
    const futureActions = screen.getAllByRole("button");
    expect(futureActions).toHaveLength(3);
    for (const action of futureActions) {
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleName(/将在成果.+实施阶段启用/);
    }

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/聊天|消息|提问/)).not.toBeInTheDocument();
  });

  it("keeps multiple dashboard instances free of duplicate IDs", async () => {
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
      await dashboard.findByRole("link", { name: "创建任务" });
      expect(dashboard.getAllByRole("button")).toHaveLength(3);
    }
  });

  it("keeps 审计员 read access while removing every 任务 creation entry", async () => {
    renderDashboard("user-auditor");

    expect(
      await screen.findByText("当前身份可查看任务，但不能创建。"),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "创建任务" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "快速创建" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看全部任务" })).toHaveAttribute(
      "href",
      "/tasks",
    );
    for (const task of workspaceDashboard.tasks) {
      expect(
        screen.getByRole("link", { name: `查看任务 ${task.id}` }),
      ).toHaveAttribute("href", `/tasks/${task.id}`);
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
