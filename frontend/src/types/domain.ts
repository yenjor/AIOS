import type {
  TaskStatus,
  TaskTemplateName,
} from "@/features/task/task-status";

export type WorkspaceRole =
  | "产品经理"
  | "开发工程师"
  | "研发负责人"
  | "Workspace Admin"
  | "Auditor";

export type BadgeTone = "info" | "warning" | "success" | "error";

export type ArtifactType = "技术方案" | "测试报告" | "需求分析报告";

export type AccessStatus = "可访问" | "无权限" | "已归档";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? ReadonlyArray<DeepReadonly<Item>>
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export interface UserIdentity {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  purpose: string;
  accessibleWorkspaceCount: number;
  lastEnteredAt: string;
  accessStatus: AccessStatus;
  unavailableReason?: string;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string;
  name: string;
  purpose: string;
  lastEnteredAt: string;
  accessStatus: AccessStatus;
  unavailableReason?: string;
}

export interface DashboardMetricSet {
  todo: number;
  runningTasks: number;
  availableAgents: number;
  pendingArtifacts: number;
}

export interface AgentSummary {
  id: string;
  name: "AI 研发员工";
  status: "运行中" | "暂停" | "异常";
  owner: string;
  autonomyLevel: "L1 辅助";
  completedToday: number;
  runningTasks: number;
  artifactsProduced: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  templateName: TaskTemplateName;
  status: TaskStatus;
  updatedAt: string;
  agentName: "AI 研发员工";
}

export interface TodoSummary {
  id: string;
  title: string;
  artifactType: ArtifactType;
  action: "去审批" | "去验收" | "查看" | "去处理";
}

export interface RiskSummary {
  id: string;
  title: string;
  tone: Extract<BadgeTone, "warning" | "error">;
  detail: string;
}

export interface QuickAction {
  id: string;
  label: "理解代码" | "分析需求" | "生成技术方案" | "辅助编码" | "Code Review" | "自动测试";
}

export interface WorkspaceDashboard {
  organization: OrganizationSummary;
  workspace: WorkspaceSummary;
  currentUser: UserIdentity;
  metrics: DashboardMetricSet;
  agent: AgentSummary;
  quickActions: QuickAction[];
  tasks: TaskSummary[];
  todos: TodoSummary[];
  risks: RiskSummary[];
}
