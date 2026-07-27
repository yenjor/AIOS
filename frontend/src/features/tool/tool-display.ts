import type {
  ActionDefinition,
  McpTransport,
  ToolConnectionTestSummary,
} from "./model";

export const MCP_TRANSPORT_LABELS: Record<McpTransport, string> = {
  STDIO: "标准输入输出（STDIO）",
  STREAMABLE_HTTP: "流式 HTTP",
};

export const TOOL_OPERATION_TYPE_LABELS: Record<
  ActionDefinition["operationType"],
  string
> = {
  READ: "读取",
  WRITE: "写入",
};

export const CONNECTION_TEST_RESULT_LABELS: Record<
  ToolConnectionTestSummary["result"],
  string
> = {
  PASSED: "已通过",
  FAILED: "未通过",
};
