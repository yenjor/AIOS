import type { AgentPermissionRequirement, AgentTestSummary } from "./model";

export const AGENT_TEST_RESULT_LABELS: Record<AgentTestSummary["result"], string> = {
  PASSED: "已通过",
  FAILED: "未通过",
  BLOCKED: "已阻断",
};

export const AGENT_PERMISSION_RESOURCE_LABELS: Record<
  AgentPermissionRequirement["resource"],
  string
> = {
  TASK: "任务",
  KNOWLEDGE: "知识库",
  TOOL: "工具",
  ARTIFACT: "成果",
};

export const AGENT_PERMISSION_ACTION_LABELS: Record<
  AgentPermissionRequirement["action"],
  string
> = {
  READ: "读取",
  USE: "使用",
  CREATE_DRAFT: "创建草稿",
};
