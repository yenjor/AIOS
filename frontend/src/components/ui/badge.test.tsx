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
    ["info", "--aios-accent"],
    ["success", "--aios-success"],
    ["warning", "--aios-warning"],
    ["error", "--aios-error"],
  ] as const)("uses the %s token for %s status text", (tone, token) => {
    render(<Badge tone={tone}>Status</Badge>);

    expect(screen.getByText("Status")).toHaveClass(`text-[var(${token})]`);
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
