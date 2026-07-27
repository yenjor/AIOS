import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { goldenTechnicalSolutionTask } from "./mock/task-fixtures";
import type { TaskPage, TaskQuery } from "./model";
import {
  RISK_LEVELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TEMPLATE_NAMES,
} from "./task-status";
import { TaskCenterScreen } from "./task-center-screen";

const page: TaskPage = {
  total: 13,
  page: 1,
  pageSize: 8,
  items: [
    {
      id: goldenTechnicalSolutionTask.id,
      scope: { ...goldenTechnicalSolutionTask.scope },
      title: goldenTechnicalSolutionTask.title,
      goalSummary: goldenTechnicalSolutionTask.goalSummary,
      templateName: goldenTechnicalSolutionTask.templateName,
      expectedArtifactType: goldenTechnicalSolutionTask.expectedArtifactType,
      status: goldenTechnicalSolutionTask.status,
      priority: goldenTechnicalSolutionTask.priority,
      riskLevel: goldenTechnicalSolutionTask.riskLevel,
      initiator: { ...goldenTechnicalSolutionTask.initiator },
      currentOwner: goldenTechnicalSolutionTask.currentOwner,
      assignedAgentName: goldenTechnicalSolutionTask.assignedAgentName,
      participantUserIds: [...goldenTechnicalSolutionTask.participantUserIds],
      approverUserIds: [...goldenTechnicalSolutionTask.approverUserIds],
      reviewerUserIds: [...goldenTechnicalSolutionTask.reviewerUserIds],
      createdAt: goldenTechnicalSolutionTask.createdAt,
      updatedAt: goldenTechnicalSolutionTask.updatedAt,
    },
  ],
};

const query: TaskQuery = {
  ownership: "all",
  page: 1,
  pageSize: 8,
};

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof TaskCenterScreen>> = {},
) {
  const props: React.ComponentProps<typeof TaskCenterScreen> = {
    scopeLabels: {
      organizationName: "光位科技",
      workspaceName: "AI 智能业务线",
    },
    canCreate: true,
    summaries: {
      mine: 4,
      pendingApproval: 1,
      executing: 1,
      pendingReview: 1,
    },
    page,
    query,
    onQueryChange: vi.fn(),
    ...overrides,
  };

  return { ...render(<TaskCenterScreen {...props} />), props };
}

describe("TaskCenterScreen", () => {
  it("shows scope, summaries, canonical filters, and a permitted create link", () => {
    renderScreen();

    expect(screen.getByRole("heading", { name: "任务中心" })).toBeVisible();
    expect(screen.getByText("组织：光位科技")).toBeVisible();
    expect(screen.getByText("工作空间：AI 智能业务线")).toBeVisible();
    expect(screen.getByRole("link", { name: "创建任务" })).toHaveAttribute(
      "href",
      "/tasks/new",
    );

    for (const [label, value] of [
      ["我的任务", "4"],
      ["待我审批", "1"],
      ["执行中", "1"],
      ["待我验收", "1"],
    ]) {
      expect(screen.getByRole("group", { name: label })).toHaveTextContent(value);
    }

    const status = screen.getByRole("combobox", { name: "状态" });
    const template = screen.getByRole("combobox", { name: "模板" });
    const risk = screen.getByRole("combobox", { name: "风险等级" });
    const ownership = screen.getByRole("combobox", { name: "任务归属" });
    expect(within(status).getAllByRole("option")).toHaveLength(
      TASK_STATUSES.length + 1,
    );
    for (const value of TASK_STATUSES) {
      expect(
        within(status).getByRole("option", {
          name: TASK_STATUS_LABELS[value],
        }),
      ).toHaveValue(value);
    }
    expect(within(template).getAllByRole("option")).toHaveLength(
      TASK_TEMPLATE_NAMES.length + 1,
    );
    expect(within(risk).getAllByRole("option")).toHaveLength(
      RISK_LEVELS.length + 1,
    );
    expect(within(ownership).getAllByRole("option")).toHaveLength(5);
  });

  it("resets pagination when filters or search change", async () => {
    const interaction = userEvent.setup();
    const onQueryChange = vi.fn();
    renderScreen({
      query: { ...query, page: 2 },
      page: { ...page, page: 2 },
      onQueryChange,
    });

    await interaction.selectOptions(
      screen.getByRole("combobox", { name: "状态" }),
      "EXECUTING",
    );
    expect(onQueryChange).toHaveBeenLastCalledWith({
      ...query,
      page: 1,
      status: "EXECUTING",
    });

    await interaction.clear(screen.getByRole("searchbox", { name: "搜索任务" }));
    await interaction.type(
      screen.getByRole("searchbox", { name: "搜索任务" }),
      "技术方案",
    );
    await interaction.click(screen.getByRole("button", { name: "搜索" }));
    expect(onQueryChange).toHaveBeenLastCalledWith({
      ...query,
      page: 1,
      keyword: "技术方案",
    });
  });

  it.each([
    ["模板", "生成技术方案", "template", "生成技术方案"],
    ["风险等级", "R2", "risk", "R2"],
    ["任务归属", "pendingApproval", "ownership", "pendingApproval"],
  ] as const)(
    "maps the %s control to the canonical repository query",
    async (label, selectedValue, key, expectedValue) => {
      const interaction = userEvent.setup();
      const onQueryChange = vi.fn();
      renderScreen({
        query: { ...query, page: 2 },
        page: { ...page, page: 2 },
        onQueryChange,
      });

      await interaction.selectOptions(
        screen.getByRole("combobox", { name: label }),
        selectedValue,
      );

      expect(onQueryChange).toHaveBeenCalledWith({
        ...query,
        page: 1,
        [key]: expectedValue,
      });
    },
  );

  it("renders desktop and mobile read models with safe detail links", () => {
    renderScreen();

    const table = screen.getByRole("table", { name: "任务列表" });
    for (const heading of [
      "任务",
      "模板",
      "状态",
      "优先级",
      "风险",
      "发起人",
      "AI 员工",
      "当前负责人",
      "预期成果",
      "更新时间",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name: heading }),
      ).toBeVisible();
    }
    expect(
      screen.getAllByRole("link", {
        name: `查看任务 ${goldenTechnicalSolutionTask.id}`,
      }),
    ).toHaveLength(2);
    for (const link of screen.getAllByRole("link", {
      name: `查看任务 ${goldenTechnicalSolutionTask.id}`,
    })) {
      expect(link).toHaveAttribute(
        "href",
        `/tasks/${goldenTechnicalSolutionTask.id}`,
      );
    }
    expect(
      screen.getAllByLabelText("任务状态：待审批"),
    ).toHaveLength(2);
  });

  it("supports stable repository pagination and an explicit empty state", async () => {
    const interaction = userEvent.setup();
    const onQueryChange = vi.fn();
    const { rerender, props } = renderScreen({ onQueryChange });

    await interaction.click(screen.getByRole("button", { name: "下一页" }));
    expect(onQueryChange).toHaveBeenCalledWith({ ...query, page: 2 });

    rerender(
      <TaskCenterScreen
        {...props}
        page={{ ...page, total: 0, items: [] }}
      />,
    );
    expect(screen.getByText("没有符合当前筛选条件的任务")).toBeVisible();
  });

  it("does not render a create entry when permission is denied", () => {
    renderScreen({ canCreate: false });

    expect(
      screen.queryByRole("link", { name: "创建任务" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("当前身份可查看任务，但不能创建。")).toBeVisible();
  });
});
