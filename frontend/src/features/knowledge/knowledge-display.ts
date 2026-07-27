import type {
  CorrectionStatus,
  KnowledgeClassification,
  KnowledgeItemStatus,
  KnowledgePipelineStageName,
  KnowledgeSourceType,
} from "./model";

export const KNOWLEDGE_CLASSIFICATION_LABELS: Record<
  KnowledgeClassification,
  string
> = {
  PUBLIC: "公开",
  INTERNAL: "内部",
  CONFIDENTIAL: "机密",
};

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  DOCUMENT: "文档",
  CODE: "代码",
  SOP: "标准作业程序",
  HISTORY: "历史记录",
  EXPERIENCE: "经验",
};

export const KNOWLEDGE_ITEM_STATUS_LABELS: Record<KnowledgeItemStatus, string> = {
  ACTIVE: "有效",
  ARCHIVED: "已归档",
};

export const KNOWLEDGE_CORRECTION_STATUS_LABELS: Record<
  CorrectionStatus,
  string
> = {
  OPEN: "待处理",
  ACCEPTED: "已接受",
  REJECTED: "已拒绝",
  CLOSED: "已关闭",
};

export const KNOWLEDGE_PIPELINE_STAGE_LABELS: Record<
  KnowledgePipelineStageName,
  string
> = {
  VERIFY: "来源验证",
  PARSE: "内容解析",
  CHUNK: "内容分块",
  EMBED: "向量化",
  INDEX: "建立索引",
  RETRIEVAL_VALIDATE: "检索验证",
};
