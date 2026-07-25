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

  it("only enables the active Workspace link and explains every disabled item", () => {
    render(<Sidebar open onClose={vi.fn()} />);

    const navigation = screen.getByRole("navigation", { name: "主要导航" });
    const links = within(navigation).getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("工作台");
    expect(links[0]).toHaveAttribute("href", "/workspace");
    expect(links[0]).toHaveAttribute("aria-current", "page");

    const disabledItems = within(navigation).getAllByLabelText(
      /将在对应实施阶段启用$/,
    );

    expect(disabledItems).toHaveLength(13);
    for (const item of disabledItems) {
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).not.toHaveAttribute("href");
      expect(item).not.toHaveAttribute("tabindex");
    }
  });

  it("exposes a mobile close control", () => {
    const onClose = vi.fn();
    render(<Sidebar open onClose={onClose} />);

    screen.getByRole("button", { name: "关闭主导航" }).click();

    expect(onClose).toHaveBeenCalledOnce();
  });
});
