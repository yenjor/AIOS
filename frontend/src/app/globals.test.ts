import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("AIOS global tokens", () => {
  it("uses an 80 percent muted control boundary against the surface", () => {
    expect(globalsCss).toContain(
      "--aios-control-border: color-mix(in srgb, var(--aios-muted) 80%, var(--aios-surface));",
    );
  });
});
