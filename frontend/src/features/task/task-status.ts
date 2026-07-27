export const TASK_STATUSES = [
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
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS = {
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
} as const satisfies Record<TaskStatus, string>;

export const TASK_TEMPLATE_NAMES = [
  "理解代码",
  "分析需求",
  "生成技术方案",
  "辅助编码",
  "代码审查",
  "自动测试",
] as const;

export type TaskTemplateName = (typeof TASK_TEMPLATE_NAMES)[number];

export const TASK_TEMPLATE_ARTIFACTS = {
  理解代码: "代码理解报告",
  分析需求: "需求分析报告",
  生成技术方案: "技术方案",
  辅助编码: "代码变更",
  "代码审查": "代码审查报告",
  自动测试: "测试报告",
} as const satisfies Record<TaskTemplateName, string>;

export type TaskArtifactType =
  (typeof TASK_TEMPLATE_ARTIFACTS)[TaskTemplateName];

export const RISK_LEVELS = ["R0", "R1", "R2", "R3"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];
