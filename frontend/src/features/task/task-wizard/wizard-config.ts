import type {
  AgentAssignment,
  CapabilityVersionRef,
  ExpectedArtifact,
  KnowledgeVersionRef,
  ToolVersionRef,
  WorkflowVersionRef,
} from "../model";
import {
  TASK_TEMPLATE_ARTIFACTS,
  TASK_TEMPLATE_NAMES,
  type TaskTemplateName,
} from "../task-status";

export const TASK_WIZARD_STEPS = [
  { step: 1, label: "选择模板" },
  { step: 2, label: "定义工作" },
  { step: 3, label: "提供上下文" },
  { step: 4, label: "定义成果" },
  { step: 5, label: "确认执行" },
] as const;

export const TASK_WIZARD_TEMPLATES = TASK_TEMPLATE_NAMES.map((name) => ({
  name,
  artifactType: TASK_TEMPLATE_ARTIFACTS[name],
  submittable: name === "生成技术方案",
}));

export const GOLDEN_TEMPLATE: TaskTemplateName = "生成技术方案";

export const TECHNICAL_SOLUTION_SECTIONS = [
  "目标理解",
  "范围与不做事项",
  "影响模块与文件",
  "技术决策",
  "风险",
  "测试建议",
  "回退考虑",
  "知识库引用",
] as const;

export const AGENT_ASSIGNMENT: AgentAssignment = {
  agentId: "agent-rd-001",
  agentName: "AI研发员工",
  agentVersionRef: {
    kind: "AGENT",
    objectId: "agent-rd-001",
    versionId: "agent-rd-001-v1",
    versionNumber: 1,
    digest: "sha256:agent-rd-001-v1",
  },
  autonomyLevel: "L1辅助",
  humanOwner: {
    userId: "user-lead",
    displayName: "陈明",
  },
};

export const TECHNICAL_SOLUTION_CAPABILITY_REF: CapabilityVersionRef = {
  kind: "CAPABILITY",
  objectId: "capability-technical-solution",
  versionId: "capability-technical-solution-v1",
  versionNumber: 1,
  digest: "sha256:capability-technical-solution-v1",
};

export const AIOS_KNOWLEDGE_REF: KnowledgeVersionRef = {
  kind: "KNOWLEDGE",
  objectId: "knowledge-aios-docs",
  versionId: "knowledge-aios-docs-v1",
  versionNumber: 1,
  digest: "sha256:knowledge-aios-docs-v1",
};

export const READ_ONLY_TOOL_REF: ToolVersionRef = {
  kind: "TOOL",
  objectId: "tool-codegraph-read",
  versionId: "tool-codegraph-read-v1",
  versionNumber: 1,
  digest: "sha256:tool-codegraph-read-v1",
  actionId: "codegraph.context",
  operationType: "READ",
};

export const TECHNICAL_SOLUTION_WORKFLOW_REF: WorkflowVersionRef = {
  kind: "WORKFLOW",
  objectId: "workflow-technical-solution",
  versionId: "workflow-technical-solution-v1",
  versionNumber: 1,
  digest: "sha256:workflow-technical-solution-v1",
};

export const APPROVAL_POINT_SUMMARIES = [
  {
    name: "计划确认",
    requiredFor: "PLAN_EXECUTION",
    reviewer: "陈明（user-lead）",
    riskLevel: "R1",
  },
  {
    name: "Artifact验收",
    requiredFor: "ARTIFACT_ACCEPTANCE",
    reviewer: "陈明（user-lead）",
    riskLevel: "R1",
  },
] as const;

export function expectedArtifactFor(
  templateName: TaskTemplateName,
): ExpectedArtifact {
  return {
    artifactType: TASK_TEMPLATE_ARTIFACTS[templateName],
    state: "EXPECTED",
    sections:
      templateName === GOLDEN_TEMPLATE
        ? [...TECHNICAL_SOLUTION_SECTIONS]
        : ["目标与范围", "执行结果", "风险与建议", "知识库引用"],
    knowledgeCitationRequired: true,
  };
}
