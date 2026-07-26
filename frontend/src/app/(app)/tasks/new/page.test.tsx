import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Task creation route shell", () => {
  it("contains only the client loader and no Task draft snapshot", () => {
    const source = readFileSync(
      resolve("src/app/(app)/tasks/new/page.tsx"),
      "utf8",
    );

    expect(source).toContain("TaskWizardLoader");
    expect(source).not.toContain("task-fixtures");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("生成 AIOS Task Center 技术方案");
  });

  it("keeps browser storage behind the public Task Repository", () => {
    for (const file of [
      "src/features/task/task-wizard/task-wizard-loader.tsx",
      "src/features/task/task-wizard/task-wizard.tsx",
    ]) {
      const source = readFileSync(resolve(file), "utf8");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("task-fixtures");
    }
  });
});
