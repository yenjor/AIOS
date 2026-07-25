import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { workspaceDashboard } from "@/mock/fixtures";

import { DashboardScreen } from "./dashboard-screen";

describe("DashboardScreen", () => {
  it("summarizes the current responsibility and exact Workspace metrics", () => {
    render(<DashboardScreen snapshot={workspaceDashboard} />);

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

  it("shows the AI employee owner, state, autonomy, and output statistics", () => {
    render(<DashboardScreen snapshot={workspaceDashboard} />);

    const agent = screen.getByRole("region", { name: "AI 研发员工" });

    expect(
      within(agent).getByRole("heading", { name: "AI 研发员工" }),
    ).toBeVisible();
    expect(within(agent).getByText("运行中", { selector: "span" })).toBeVisible();
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
    render(<DashboardScreen snapshot={workspaceDashboard} />);

    const quickActions = screen.getByRole("region", { name: "快速创建" });
    const buttons = within(quickActions).getAllByRole("button");

    expect(buttons).toHaveLength(6);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "理解代码",
      "分析需求",
      "生成技术方案",
      "辅助编码",
      "Code Review",
      "自动测试",
    ]);

    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(
        "将在 Task 创建流程实施阶段启用",
      );
    }
  });

  it("renders the recent Task table, Artifact todos, and risk list", () => {
    render(<DashboardScreen snapshot={workspaceDashboard} />);

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
    }

    const todos = screen.getByRole("region", { name: "我的待办" });
    expect(within(todos).getAllByRole("listitem")).toHaveLength(3);
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

  it("keeps every future action inert and does not expose a chat input", () => {
    render(<DashboardScreen snapshot={workspaceDashboard} />);

    const futureActions = screen.getAllByRole("button");
    expect(futureActions).toHaveLength(11);
    for (const action of futureActions) {
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleDescription();
    }

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/聊天|消息|提问/)).not.toBeInTheDocument();
  });

  it("accepts the canonical readonly fixture without modifying it", () => {
    const beforeRender = JSON.stringify(workspaceDashboard);

    render(<DashboardScreen snapshot={workspaceDashboard} />);

    expect(JSON.stringify(workspaceDashboard)).toBe(beforeRender);
    expect(Object.isFrozen(workspaceDashboard)).toBe(true);
    expect(Object.isFrozen(workspaceDashboard.tasks)).toBe(true);
  });
});
