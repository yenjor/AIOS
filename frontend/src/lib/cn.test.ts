import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("merges conflicting Tailwind utilities while retaining non-conflicting classes", () => {
    expect(cn("rounded-lg px-4", "rounded-none", false && "hidden")).toBe("px-4 rounded-none");
  });
});
