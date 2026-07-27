import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders warning status text", () => {
    render(<Badge tone="warning">待审批</Badge>);

    expect(screen.getByText("待审批")).toBeVisible();
  });

  it.each([
    ["info", "--aios-info-foreground"],
    ["success", "--aios-success-foreground"],
    ["warning", "--aios-warning-foreground"],
    ["error", "--aios-error-foreground"],
  ] as const)("uses the accessible %s foreground token for %s status text", (tone, token) => {
    render(<Badge tone={tone}>状态</Badge>);

    expect(screen.getByText("状态")).toHaveClass(`text-[var(${token})]`);
  });

  it("forwards native attributes and refs", () => {
    const ref = createRef<HTMLSpanElement>();

    render(
      <Badge aria-label="审批状态" data-testid="status-badge" ref={ref}>
        待审批
      </Badge>,
    );

    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("aria-label", "审批状态");
    expect(ref.current).toBe(badge);
  });
});
