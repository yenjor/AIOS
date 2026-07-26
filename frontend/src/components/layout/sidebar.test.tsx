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
      expect(within(navigation).getByRole("heading", { name: group })).toBeVisible();
    }

    const approvedItems = [
      "工作台",
      "Task",
      "审批待办",
      "Artifact",
      "AI 员工",
      "Knowledge",
      "Capability",
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

  it("enables Workspace, Task and Knowledge while explaining every future item", () => {
    render(<Sidebar open onClose={vi.fn()} />);

    const navigation = screen.getByRole("navigation", { name: "主要导航" });
    const enabledLinks = navigation.querySelectorAll("a[href]");

    expect(enabledLinks).toHaveLength(3);
    expect(enabledLinks[0]).toHaveAccessibleName("工作台");
    expect(enabledLinks[0]).toHaveAttribute("href", "/workspace");
    expect(enabledLinks[0]).toHaveAttribute("aria-current", "page");
    expect(enabledLinks[1]).toHaveAccessibleName("Task");
    expect(enabledLinks[1]).toHaveAttribute("href", "/tasks");
    expect(enabledLinks[2]).toHaveAccessibleName("Knowledge");
    expect(enabledLinks[2]).toHaveAttribute("href", "/knowledge");

    const disabledLabels = [
      "审批待办，3 项待处理",
      "Artifact",
      "AI 员工",
      "Capability",
      "Workflow",
      "Tool",
      "MCP 连接",
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
    expect(within(brand).getByText("A")).toHaveClass("md:inline", "xl:hidden");
    expect(within(brand).getByText("AIOS", { selector: "[aria-hidden='true']" })).toHaveClass(
      "md:hidden",
      "xl:inline",
    );
  });
});
