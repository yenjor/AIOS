import type { WorkspaceDashboard } from "@/types/domain";

const users = {
  linYue: { id: "user-lin-yue", name: "林悦", role: "产品经理" },
  zhouHang: { id: "user-zhou-hang", name: "周航", role: "开发工程师" },
  chenMing: { id: "user-chen-ming", name: "陈明", role: "研发负责人" },
  wuTong: { id: "user-wu-tong", name: "吴桐", role: "Workspace Admin" },
  zhaoLan: { id: "user-zhao-lan", name: "赵岚", role: "Auditor" },
} as const satisfies Record<string, WorkspaceDashboard["currentUser"]>;

export const workspaceDashboard = {
  organization: {
    id: "org-guangwei",
    name: "光位科技",
  },
  workspace: {
    id: "ws-ai",
    organizationId: "org-guangwei",
    name: "AI 智能业务线",
    purpose: "建设并验证企业 AI 研发员工",
  },
  currentUser: users.chenMing,
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
    owner: users.chenMing,
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
    { id: "task-001", title: "用户中心登录流程重构", stage: "研发实现", status: "执行中", tone: "info", updatedAt: "10 分钟前", agentName: "AI 研发员工" },
    { id: "task-002", title: "订单服务性能优化方案", stage: "技术方案", status: "待审批", tone: "warning", updatedAt: "35 分钟前", agentName: "AI 研发员工" },
    { id: "task-003", title: "支付模块单元测试补充", stage: "自动测试", status: "执行中", tone: "info", updatedAt: "1 小时前", agentName: "AI 研发员工" },
    { id: "task-004", title: "商品搜索功能需求分析", stage: "分析需求", status: "需补充", tone: "error", updatedAt: "2 小时前", agentName: "AI 研发员工" },
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
} satisfies WorkspaceDashboard;
