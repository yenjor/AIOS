import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
}));

describe("Sidebar", () => {
  it("renders the four approved groups and every approved navigation item", () => {
    render(<Sidebar open onClose={vi.fn()} />);

    const navigation = screen.getByRole("navigation", { name: "主要导航" });

    for (const group of ["工作", "AI 资源", "企业连接", "管理与治理"]) {
      expect(
        within(navigation).getByRole("heading", { name: group }),
      ).toBeVisible();
    }

    const approvedItems = [
      "工作台",
      "Task",
      "审批待办",
      "Artifact",
      "AI 员工",
      "知识库",
      "能力中心",
      "Workflow",
      "Tool",
      "MCP 连接",
      "Plugin 管理",
      "Organization",
      "成员与权限",
      "Audit",
    ];

    for (const label of approvedItems) {
      expect(within(navigation).getByText(label)).toBeVisible();
    }

    expect(within(navigation).getByText("3")).toBeVisible();
  });

  it("enables implemented work, AI resource and enterprise connection modules", () => {
    render(<Sidebar open onClose={vi.fn()} />);

    const navigation = screen.getByRole("navigation", { name: "主要导航" });
    const enabledLinks = navigation.querySelectorAll("a[href]");

    expect(enabledLinks).toHaveLength(7);
    expect(enabledLinks[0]).toHaveAccessibleName("工作台");
    expect(enabledLinks[0]).toHaveAttribute("href", "/workspace");
    expect(enabledLinks[0]).toHaveAttribute("aria-current", "page");
    expect(enabledLinks[1]).toHaveAccessibleName("Task");
    expect(enabledLinks[1]).toHaveAttribute("href", "/tasks");
    expect(enabledLinks[2]).toHaveAccessibleName("AI 员工");
    expect(enabledLinks[2]).toHaveAttribute("href", "/agents");
    expect(enabledLinks[3]).toHaveAccessibleName("知识库");
    expect(enabledLinks[3]).toHaveAttribute("href", "/knowledge");
    expect(enabledLinks[4]).toHaveAccessibleName("能力中心");
    expect(enabledLinks[4]).toHaveAttribute("href", "/capabilities");
    expect(enabledLinks[5]).toHaveAccessibleName("Tool");
    expect(enabledLinks[5]).toHaveAttribute("href", "/tools");
    expect(enabledLinks[6]).toHaveAccessibleName("MCP 连接");
    expect(enabledLinks[6]).toHaveAttribute("href", "/tools/mcp");

    const disabledLabels = [
      "审批待办，3 项待处理",
      "Artifact",
      "Workflow",
      "Plugin 管理",
      "Organization",
      "成员与权限",
      "Audit",
    ];

    for (const label of disabledLabels) {
      const item = within(navigation).getByRole("link", { name: label });
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).toHaveAccessibleDescription("将在对应实施阶段启用");
      expect(item).not.toHaveAttribute("href");
      expect(item).not.toHaveAttribute("tabindex");
    }

    expect(within(navigation).getAllByRole("link")).toHaveLength(14);
  });

  it("exposes a mobile close control", () => {
    const onClose = vi.fn();
    render(<Sidebar open onClose={onClose} />);

    screen.getByRole("button", { name: "关闭主导航" }).click();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("provides a compact tablet logo without losing the accessible AIOS name", () => {
    render(<Sidebar open onClose={vi.fn()} />);

    const brand = screen.getByTestId("sidebar-brand");
    expect(brand).toHaveTextContent("AIOS");
    expect(within(brand).getByText("A")).toHaveClass(
      "md:inline",
      "xl:hidden",
    );
    expect(
      within(brand).getByText("AIOS", {
        selector: "[aria-hidden='true']",
      }),
    ).toHaveClass("md:hidden", "xl:inline");
  });
});
