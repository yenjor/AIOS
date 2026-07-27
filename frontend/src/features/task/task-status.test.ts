import { describe, expect, expectTypeOf, it } from "vitest";

import {
  RISK_LEVELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TEMPLATE_ARTIFACTS,
  TASK_TEMPLATE_NAMES,
  type TaskStatus,
} from "./task-status";

describe("任务 status and template contracts", () => {
  it("keeps the twelve persisted TaskStatus values in their canonical order", () => {
    expect(TASK_STATUSES).toEqual([
      "DRAFT",
      "READY",
      "PLANNING",
      "NEED_INPUT",
      "NEED_APPROVAL",
      "EXECUTING",
      "PAUSED",
      "FAILED",
      "REVIEW",
      "REWORK",
      "COMPLETED",
      "CANCELLED",
    ]);
    expect(new Set(TASK_STATUSES)).toHaveLength(12);
    expectTypeOf<(typeof TASK_STATUSES)[number]>().toEqualTypeOf<TaskStatus>();
  });

  it("maps every persisted status to the approved Chinese UI label", () => {
    expect(TASK_STATUS_LABELS).toEqual({
      DRAFT: "草稿",
      READY: "已就绪",
      PLANNING: "规划中",
      NEED_INPUT: "需补充",
      NEED_APPROVAL: "待审批",
      EXECUTING: "执行中",
      PAUSED: "已暂停",
      FAILED: "失败",
      REVIEW: "待验收",
      REWORK: "返工中",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
    });
    expect(Object.keys(TASK_STATUS_LABELS)).toEqual(TASK_STATUSES);
  });

  it("keeps the six approved 任务 templates and 成果 mappings", () => {
    expect(TASK_TEMPLATE_NAMES).toEqual([
      "理解代码",
      "分析需求",
      "生成技术方案",
      "辅助编码",
      "代码审查",
      "自动测试",
    ]);
    expect(TASK_TEMPLATE_ARTIFACTS).toEqual({
      理解代码: "代码理解报告",
      分析需求: "需求分析报告",
      生成技术方案: "技术方案",
      辅助编码: "代码变更",
      "代码审查": "代码审查报告",
      自动测试: "测试报告",
    });
  });

  it("uses only the four established risk levels", () => {
    expect(RISK_LEVELS).toEqual(["R0", "R1", "R2", "R3"]);
  });
});
