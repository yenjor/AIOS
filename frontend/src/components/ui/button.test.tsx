import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a disabled named button", () => {
    render(<Button disabled>创建任务</Button>);

    expect(screen.getByRole("button", { name: "创建任务" })).toBeDisabled();
  });

  it("uses the primary token and merges custom class conflicts", () => {
    render(<Button className="rounded-none">创建任务</Button>);

    const button = screen.getByRole("button", { name: "创建任务" });
    expect(button).toHaveClass("bg-[var(--aios-primary)]", "rounded-none");
    expect(button).not.toHaveClass("rounded-lg");
  });

  it("uses the accessible control border token for the secondary variant", () => {
    render(<Button variant="secondary">创建任务</Button>);

    expect(screen.getByRole("button", { name: "创建任务" })).toHaveClass(
      "border-[var(--aios-control-border)]",
    );
  });

  it("defaults to button type and forwards native attributes and refs", () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <Button aria-describedby="button-description" data-testid="create-button" ref={ref}>
        创建任务
      </Button>,
    );

    const button = screen.getByTestId("create-button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-describedby", "button-description");
    expect(ref.current).toBe(button);
  });
});
