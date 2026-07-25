import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Card } from "./card";

describe("Card", () => {
  it("renders a generic div with surface token styling and forwards refs", () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <Card className="rounded-none" data-testid="metric-card" ref={ref}>
        Metrics
      </Card>,
    );

    const card = screen.getByTestId("metric-card");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveClass("bg-[var(--aios-surface)]", "rounded-none");
    expect(card).not.toHaveClass("rounded-[10px]");
    expect(ref.current).toBe(card);
  });
});
