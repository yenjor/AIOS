import {
  Bot,
  Boxes,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  ListTodo,
  Plug,
  Puzzle,
  ScrollText,
  UsersRound,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  enabled: boolean;
  icon: LucideIcon;
  badge?: number;
}

export interface NavigationGroup {
  label: "工作" | "AI 资源" | "企业连接" | "管理与治理";
  items: NavigationItem[];
}

export const navigation: NavigationGroup[] = [
  {
    label: "工作",
    items: [
      { label: "工作台", href: "/workspace", enabled: true, icon: Gauge },
      { label: "Task", href: "/tasks", enabled: false, icon: ListTodo },
      {
        label: "审批待办",
        href: "/approvals",
        enabled: false,
        icon: ClipboardCheck,
        badge: 3,
      },
      { label: "Artifact", href: "/artifacts", enabled: false, icon: FileCheck2 },
    ],
  },
  {
    label: "AI 资源",
    items: [
      { label: "AI 员工", href: "/agents", enabled: false, icon: Bot },
      { label: "Knowledge", href: "/knowledge", enabled: false, icon: BrainCircuit },
      { label: "Capability", href: "/capabilities", enabled: false, icon: Boxes },
      { label: "Workflow", href: "/workflows", enabled: false, icon: Workflow },
    ],
  },
  {
    label: "企业连接",
    items: [
      { label: "Tool", href: "/tools", enabled: false, icon: Wrench },
      { label: "MCP 连接", href: "/tools/mcp", enabled: false, icon: Plug },
      { label: "Plugin 管理", href: "/plugins", enabled: false, icon: Puzzle },
    ],
  },
  {
    label: "管理与治理",
    items: [
      {
        label: "Organization",
        href: "/organization",
        enabled: false,
        icon: Building2,
      },
      { label: "成员与权限", href: "/members", enabled: false, icon: UsersRound },
      { label: "Audit", href: "/audit", enabled: false, icon: ScrollText },
    ],
  },
];
