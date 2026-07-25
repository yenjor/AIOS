import type {
  DeepReadonly,
  OrganizationSummary,
  UserIdentity,
  WorkspaceDashboard,
  WorkspaceSummary,
} from "@/types/domain";

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  for (const nestedValue of Object.values(value)) {
    if (nestedValue !== null && typeof nestedValue === "object" && !Object.isFrozen(nestedValue)) {
      deepFreeze(nestedValue);
    }
  }

  return Object.freeze(value) as DeepReadonly<T>;
}

export const organization: DeepReadonly<OrganizationSummary> = deepFreeze({
  id: "org-guangwei",
  name: "光位科技",
  purpose: "管理光位科技企业 AI 资源与工作范围",
  accessibleWorkspaceCount: 1,
  lastEnteredAt: "2026-07-24 18:30",
  accessStatus: "可访问",
});

export const workspace: DeepReadonly<WorkspaceSummary> = deepFreeze({
  id: "ws-ai",
  organizationId: organization.id,
  name: "AI 智能业务线",
  purpose: "建设并验证企业 AI 研发员工",
  lastEnteredAt: "2026-07-25 09:12",
  accessStatus: "可访问",
});

const archivedWorkspace: DeepReadonly<WorkspaceSummary> = deepFreeze({
  id: "ws-archive-001",
  organizationId: organization.id,
  name: "历史研发试验区",
  purpose: "保留已结束的研发协作试点记录",
  lastEnteredAt: "2026-05-18 16:20",
  accessStatus: "已归档",
  unavailableReason: "该 Workspace 已归档，仅可查看范围信息",
});

export const workspaces: DeepReadonly<WorkspaceSummary[]> = deepFreeze<
  WorkspaceSummary[]
>([workspace, archivedWorkspace]);

export const users: DeepReadonly<UserIdentity[]> = deepFreeze<UserIdentity[]>([
  { id: "user-pm", name: "林悦", role: "产品经理" },
  { id: "user-dev", name: "周航", role: "开发工程师" },
  { id: "user-lead", name: "陈明", role: "研发负责人" },
  { id: "user-admin", name: "吴桐", role: "Workspace Admin" },
  { id: "user-auditor", name: "赵岚", role: "Auditor" },
]);

export const workspaceDashboard: DeepReadonly<WorkspaceDashboard> = deepFreeze<WorkspaceDashboard>({
  organization,
  workspace,
  currentUser: users[2],
  metrics: {
    todo: 5,
    runningTasks: 12,
    availableAgents: 1,
    pendingArtifacts: 3,
  },
  agent: {
    id: "agent-rd-001",
    name: "AI 研发员工",
    status: "运行中",
    owner: "陈明",
    autonomyLevel: "L1 辅助",
    completedToday: 8,
    runningTasks: 5,
    artifactsProduced: 32,
  },
  quickActions: [
    { id: "quick-understand-code", label: "理解代码" },
    { id: "quick-analyze-requirement", label: "分析需求" },
    { id: "quick-generate-solution", label: "生成技术方案" },
    { id: "quick-assist-coding", label: "辅助编码" },
    { id: "quick-code-review", label: "Code Review" },
    { id: "quick-automated-test", label: "自动测试" },
  ],
  tasks: [
    { id: "task-001", title: "用户中心登录流程重构", type: "研发实现", status: "执行中", tone: "info", updatedAt: "10 分钟前", agentName: "AI 研发员工" },
    { id: "task-002", title: "订单服务性能优化方案", type: "技术方案", status: "待审批", tone: "warning", updatedAt: "35 分钟前", agentName: "AI 研发员工" },
    { id: "task-003", title: "支付模块单元测试补充", type: "自动测试", status: "执行中", tone: "info", updatedAt: "1 小时前", agentName: "AI 研发员工" },
    { id: "task-004", title: "商品搜索功能需求分析", type: "分析需求", status: "需补充", tone: "error", updatedAt: "2 小时前", agentName: "AI 研发员工" },
  ],
  todos: [
    { id: "todo-001", title: "订单服务性能优化方案", artifactType: "技术方案", action: "去审批" },
    { id: "todo-002", title: "支付模块自动化测试报告", artifactType: "测试报告", action: "去验收" },
    { id: "todo-003", title: "商品搜索功能需求分析", artifactType: "需求分析报告", action: "去处理" },
  ],
  risks: [
    { id: "risk-001", title: "需求澄清不足", tone: "warning", detail: "商品搜索功能仍有 3 条澄清项等待确认" },
    { id: "risk-002", title: "Task 超期", tone: "error", detail: "用户中心接口文档更新已超过期望完成时间" },
  ],
});
