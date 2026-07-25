export type WorkspaceRole =
  | "产品经理"
  | "开发工程师"
  | "研发负责人"
  | "Workspace Admin"
  | "Auditor";

export type TaskStatus = "执行中" | "待审批" | "已完成" | "需补充";

export type BadgeTone = "info" | "warning" | "success" | "error";

export type TaskType = "研发实现" | "技术方案" | "自动测试" | "分析需求";

export type ArtifactType = "技术方案" | "测试报告" | "需求分析报告";

export interface UserIdentity {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface OrganizationSummary {
  id: string;
  name: string;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string;
  name: string;
  purpose: string;
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
  type: TaskType;
  status: TaskStatus;
  tone: BadgeTone;
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
