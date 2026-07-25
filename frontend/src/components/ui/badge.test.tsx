import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders warning status text", () => {
    render(<Badge tone="warning">待审批</Badge>);

    expect(screen.getByText("待审批")).toBeVisible();
  });
});
