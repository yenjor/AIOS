import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a disabled named button", () => {
    render(<Button disabled>创建 Task</Button>);

    expect(screen.getByRole("button", { name: "创建 Task" })).toBeDisabled();
  });
});
