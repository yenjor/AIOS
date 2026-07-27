import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("任务中心 route shell", () => {
  it("exports metadata and delegates all 任务 data to the client loader", () => {
    const source = readFileSync(
      resolve("src/app/(app)/tasks/page.tsx"),
      "utf8",
    );

    expect(source).toContain("TaskCenterLoader");
    expect(source).toContain('title: "任务中心 | AIOS"');
    expect(source).not.toContain("task-fixtures");
    expect(source).not.toContain("listTasks");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("task-seed-");
    expect(source).not.toContain("生成 AIOS 任务中心技术方案");
  });
});
