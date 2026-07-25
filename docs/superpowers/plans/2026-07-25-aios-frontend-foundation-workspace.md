# AIOS Frontend Foundation and Workspace Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable AIOS Next.js increment with the shared design system, complete README-aligned navigation, Mock identity and scope selection, and the Workspace dashboard.

**Architecture:** Use the Next.js App Router and strict TypeScript. Keep UI state behind typed Mock providers so later REST integration can replace adapters without changing pages. Organize code by the existing AIOS modules, with MCP contained by Tool and Plugin represented only as an extension-management surface.

**Tech Stack:** Next.js 16.2.11, React 19.2.8, TypeScript, Tailwind CSS 4, shadcn/ui-compatible primitives, Vitest, Testing Library, Playwright.

---

## 1. Scope and plan sequence

The approved design contains four independently testable subprojects. This plan implements the first:

1. Frontend foundation, complete navigation, identity/scope selection, Workspace dashboard;
2. Task, approval, and Artifact work loop;
3. Agent, Knowledge, Capability, and Workflow resource management;
4. Tool, MCP, Plugin, Organization, permissions, and Audit configuration.

This increment must produce working software by itself. Navigation entries for unimplemented routes are visible because they communicate the approved AIOS structure, but they are rendered as disabled entries with an accessible explanation until their owning subproject is implemented. No empty route or fake success screen is created.

## 2. File structure

| Path | Responsibility |
|---|---|
| `frontend/package.json` | Frontend dependencies and quality scripts |
| `frontend/vitest.config.mts` | Component and unit test environment |
| `frontend/src/test/setup-tests.ts` | Testing Library matchers and cleanup |
| `frontend/src/app/globals.css` | AIOS design tokens and global styles |
| `frontend/src/app/layout.tsx` | Root document and Mock provider composition |
| `frontend/src/app/page.tsx` | Product entry page |
| `frontend/src/app/login/page.tsx` | Mock identity selection |
| `frontend/src/app/organizations/page.tsx` | Organization selection |
| `frontend/src/app/workspaces/page.tsx` | Workspace selection |
| `frontend/src/app/(app)/layout.tsx` | Authenticated application shell |
| `frontend/src/app/(app)/workspace/page.tsx` | Workspace dashboard route |
| `frontend/src/components/ui/button.tsx` | Shared button variants |
| `frontend/src/components/ui/badge.tsx` | Text-backed semantic status badge |
| `frontend/src/components/ui/card.tsx` | Shared surface component |
| `frontend/src/components/layout/sidebar.tsx` | README-aligned grouped navigation |
| `frontend/src/components/layout/topbar.tsx` | Scope, create Task, notifications, user |
| `frontend/src/components/layout/app-shell.tsx` | Responsive shell composition |
| `frontend/src/config/navigation.ts` | Navigation groups and implementation status |
| `frontend/src/features/session/session-provider.tsx` | Mock user, Organization, Workspace state |
| `frontend/src/features/workspace/dashboard-screen.tsx` | Workspace dashboard composition |
| `frontend/src/features/workspace/metric-card.tsx` | Dashboard metric presentation |
| `frontend/src/lib/cn.ts` | Tailwind class composition |
| `frontend/src/mock/fixtures.ts` | Deterministic single-tenant test data |
| `frontend/src/mock/repository.ts` | Async Mock query boundary |
| `frontend/src/types/domain.ts` | UI contract types using approved terminology |
| `frontend/tests/workspace-dashboard.spec.ts` | Golden browser flow |

## 3. Task plan

### Task 1: Scaffold the Next.js application and test runner

**Files:**
- Delete: `frontend/.gitkeep`
- Create: `frontend/package.json`
- Create: `frontend/package-lock.json`
- Create: `frontend/vitest.config.mts`
- Create: `frontend/src/test/setup-tests.ts`
- Modify: `frontend/src/app/page.tsx`
- Test: `frontend/src/app/page.test.tsx`

- [ ] **Step 1: Remove the directory marker and scaffold the pinned framework**

Run from the repository root:

```powershell
Remove-Item -LiteralPath 'frontend\.gitkeep'
npx create-next-app@16.2.11 frontend --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-npm --yes
```

Expected: `frontend/package.json`, `frontend/src/app/layout.tsx`, and `frontend/src/app/page.tsx` exist; `README.md` at the repository root is unchanged.

- [ ] **Step 2: Install shared UI and test dependencies**

```powershell
npm --prefix frontend install lucide-react@1.26.0 clsx@2.1.1 tailwind-merge@3.6.0 class-variance-authority@0.7.1
npm --prefix frontend install --save-dev vitest@4.1.10 jsdom@29.1.1 @vitejs/plugin-react@6.0.4 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.0 @testing-library/user-event@14.6.1 @playwright/test@1.62.0
```

Expected: both commands exit with code 0 and update `frontend/package-lock.json`.

- [ ] **Step 3: Add deterministic test configuration**

Create `frontend/vitest.config.mts`:

```ts
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup-tests.ts"],
    css: true,
  },
});
```

Create `frontend/src/test/setup-tests.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

Add these scripts to `frontend/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Write the failing product-entry test**

Create `frontend/src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("AIOS product entry", () => {
  it("introduces the work operating system and links to identity selection", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "企业 AI 工作操作系统" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入 AIOS" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
```

- [ ] **Step 5: Run the test and verify the generated page fails**

```powershell
npm --prefix frontend test -- src/app/page.test.tsx
```

Expected: FAIL because the generated page does not contain the AIOS heading.

- [ ] **Step 6: Implement the minimal product entry**

Replace `frontend/src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F7FB] px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
        <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-indigo-600">
          AIOS
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-[#172033]">
          企业 AI 工作操作系统
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#667085]">
          统一管理企业 Knowledge、Capability、Agent、Task、Tool、Artifact
          与 Audit，让 AI 员工在明确责任和权限边界内完成工作。
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          进入 AIOS
        </Link>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Verify tests, types, lint, and build**

```powershell
npm --prefix frontend test -- src/app/page.test.tsx
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

Expected: all commands exit with code 0.

- [ ] **Step 8: Commit the scaffold**

```powershell
git add frontend
git commit -m "feat(frontend): scaffold AIOS web application"
```

### Task 2: Establish the accessible design-system primitives

**Files:**
- Create: `frontend/src/lib/cn.ts`
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/src/components/ui/button.test.tsx`
- Test: `frontend/src/components/ui/badge.test.tsx`

- [ ] **Step 1: Write failing primitive tests**

Create `frontend/src/components/ui/button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("exposes a clear disabled state", () => {
    render(<Button disabled>创建 Task</Button>);

    expect(screen.getByRole("button", { name: "创建 Task" })).toBeDisabled();
  });
});
```

Create `frontend/src/components/ui/badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("uses text in addition to color for status", () => {
    render(<Badge tone="warning">待审批</Badge>);

    expect(screen.getByText("待审批")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests and verify missing modules**

```powershell
npm --prefix frontend test -- src/components/ui/button.test.tsx src/components/ui/badge.test.tsx
```

Expected: FAIL because `button.tsx` and `badge.tsx` do not exist.

- [ ] **Step 3: Implement class composition**

Create `frontend/src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Implement Button, Badge, and Card**

Create `frontend/src/components/ui/button.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600",
        secondary:
          "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-indigo-600",
        danger:
          "bg-[#C4320A] text-white hover:bg-[#A72B0A] focus-visible:outline-[#C4320A]",
        ghost:
          "text-slate-600 hover:bg-slate-100 focus-visible:outline-indigo-600",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}
```

Create `frontend/src/components/ui/badge.tsx`:

```tsx
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-cyan-50 text-cyan-800",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-800",
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof tones;
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
```

Create `frontend/src/components/ui/card.tsx`:

```tsx
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-[10px] border border-slate-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Replace the global token layer**

Replace `frontend/src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --aios-navigation: #0b1220;
  --aios-primary: #4f46e5;
  --aios-accent: #0891b2;
  --aios-canvas: #f5f7fb;
  --aios-surface: #ffffff;
  --aios-text: #172033;
  --aios-muted: #667085;
  --aios-success: #16803c;
  --aios-warning: #b54708;
  --aios-error: #c4320a;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--aios-canvas);
}

body {
  margin: 0;
  background: var(--aios-canvas);
  color: var(--aios-text);
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

button,
a,
input,
select,
textarea {
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 6: Run primitive tests and quality checks**

```powershell
npm --prefix frontend test -- src/components/ui/button.test.tsx src/components/ui/badge.test.tsx
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

Expected: all commands exit with code 0.

- [ ] **Step 7: Commit the design primitives**

```powershell
git add frontend/src/app/globals.css frontend/src/components frontend/src/lib
git commit -m "feat(frontend): add AIOS design primitives"
```

### Task 3: Define approved UI contracts and deterministic Mock data

**Files:**
- Create: `frontend/src/types/domain.ts`
- Create: `frontend/src/mock/fixtures.ts`
- Create: `frontend/src/mock/repository.ts`
- Test: `frontend/src/mock/repository.test.ts`

- [ ] **Step 1: Write failing Mock repository tests**

Create `frontend/src/mock/repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getWorkspaceDashboard } from "./repository";

describe("Mock repository", () => {
  it("returns only the requested Workspace dashboard", async () => {
    const snapshot = await getWorkspaceDashboard("ws-ai");

    expect(snapshot.workspace.id).toBe("ws-ai");
    expect(snapshot.agent.name).toBe("AI 研发员工");
    expect(snapshot.metrics).toEqual({
      todo: 5,
      runningTasks: 12,
      availableAgents: 1,
      pendingArtifacts: 3,
    });
  });

  it("rejects an unknown Workspace instead of leaking another scope", async () => {
    await expect(getWorkspaceDashboard("ws-unknown")).rejects.toThrow(
      "Workspace not found",
    );
  });

  it("does not expose plaintext credential material", async () => {
    const snapshot = await getWorkspaceDashboard("ws-ai");
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toMatch(/api[_-]?key|access[_-]?token|client[_-]?secret/i);
  });
});
```

- [ ] **Step 2: Run the test and verify missing repository**

```powershell
npm --prefix frontend test -- src/mock/repository.test.ts
```

Expected: FAIL because the Mock repository does not exist.

- [ ] **Step 3: Define the UI contract types**

Create `frontend/src/types/domain.ts`:

```ts
export type WorkspaceRole =
  | "产品经理"
  | "开发工程师"
  | "研发负责人"
  | "Workspace Admin"
  | "Auditor";

export type TaskStatus = "执行中" | "待审批" | "已完成" | "需补充";
export type BadgeTone = "info" | "warning" | "success" | "error";

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
  type: string;
  agentName: "AI 研发员工";
  status: TaskStatus;
  tone: BadgeTone;
  updatedAt: string;
}

export interface TodoSummary {
  id: string;
  title: string;
  artifactType: string;
  action: "去审批" | "去验收" | "查看" | "去处理";
}

export interface RiskSummary {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "error";
}

export interface QuickAction {
  id: string;
  label:
    | "理解代码"
    | "分析需求"
    | "生成技术方案"
    | "辅助编码"
    | "Code Review"
    | "自动测试";
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
```

- [ ] **Step 4: Add deterministic fixtures**

Create `frontend/src/mock/fixtures.ts`:

```ts
import type {
  OrganizationSummary,
  UserIdentity,
  WorkspaceDashboard,
  WorkspaceSummary,
} from "@/types/domain";

export const organization: OrganizationSummary = {
  id: "org-guangwei",
  name: "光位科技",
};

export const workspace: WorkspaceSummary = {
  id: "ws-ai",
  organizationId: organization.id,
  name: "AI 智能业务线",
  purpose: "建设并验证企业 AI 研发员工",
};

export const users: UserIdentity[] = [
  { id: "user-pm", name: "林悦", role: "产品经理" },
  { id: "user-dev", name: "周航", role: "开发工程师" },
  { id: "user-lead", name: "陈明", role: "研发负责人" },
  { id: "user-admin", name: "吴桐", role: "Workspace Admin" },
  { id: "user-auditor", name: "赵岚", role: "Auditor" },
];

export const workspaceDashboard: WorkspaceDashboard = {
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
    { id: "understand-code", label: "理解代码" },
    { id: "analyze-requirement", label: "分析需求" },
    { id: "technical-solution", label: "生成技术方案" },
    { id: "assist-coding", label: "辅助编码" },
    { id: "code-review", label: "Code Review" },
    { id: "automated-testing", label: "自动测试" },
  ],
  tasks: [
    {
      id: "task-001",
      title: "用户中心登录流程重构",
      type: "研发实现",
      agentName: "AI 研发员工",
      status: "执行中",
      tone: "info",
      updatedAt: "10 分钟前",
    },
    {
      id: "task-002",
      title: "订单服务性能优化方案",
      type: "技术方案",
      agentName: "AI 研发员工",
      status: "待审批",
      tone: "warning",
      updatedAt: "35 分钟前",
    },
    {
      id: "task-003",
      title: "支付模块单元测试补充",
      type: "自动测试",
      agentName: "AI 研发员工",
      status: "执行中",
      tone: "info",
      updatedAt: "1 小时前",
    },
    {
      id: "task-004",
      title: "商品搜索功能需求分析",
      type: "分析需求",
      agentName: "AI 研发员工",
      status: "需补充",
      tone: "error",
      updatedAt: "2 小时前",
    },
  ],
  todos: [
    {
      id: "todo-001",
      title: "订单服务性能优化方案",
      artifactType: "技术方案",
      action: "去审批",
    },
    {
      id: "todo-002",
      title: "支付模块自动化测试报告",
      artifactType: "测试报告",
      action: "去验收",
    },
    {
      id: "todo-003",
      title: "商品搜索功能需求分析",
      artifactType: "需求分析报告",
      action: "去处理",
    },
  ],
  risks: [
    {
      id: "risk-001",
      title: "需求澄清不足",
      detail: "商品搜索功能仍有 3 条澄清项等待确认",
      tone: "warning",
    },
    {
      id: "risk-002",
      title: "Task 超期",
      detail: "用户中心接口文档更新已超过期望完成时间",
      tone: "error",
    },
  ],
};
```

- [ ] **Step 5: Implement the async Mock boundary**

Create `frontend/src/mock/repository.ts`:

```ts
import { workspaceDashboard } from "./fixtures";

const MOCK_LATENCY_MS = 30;

export async function getWorkspaceDashboard(workspaceId: string) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  if (workspaceId !== workspaceDashboard.workspace.id) {
    throw new Error("Workspace not found");
  }

  return structuredClone(workspaceDashboard);
}
```

- [ ] **Step 6: Run Mock tests and quality checks**

```powershell
npm --prefix frontend test -- src/mock/repository.test.ts
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

Expected: all commands exit with code 0.

- [ ] **Step 7: Commit the UI contracts**

```powershell
git add frontend/src/types frontend/src/mock
git commit -m "feat(frontend): add typed AIOS mock contracts"
```

### Task 4: Implement Mock identity and enterprise scope selection

**Files:**
- Create: `frontend/src/features/session/session-provider.tsx`
- Create: `frontend/src/features/session/session-provider.test.tsx`
- Create: `frontend/src/app/providers.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/organizations/page.tsx`
- Create: `frontend/src/app/workspaces/page.tsx`

- [ ] **Step 1: Write the failing session test**

Create `frontend/src/features/session/session-provider.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SessionProvider, useSession } from "./session-provider";

function Harness() {
  const { session, selectUser, selectOrganization, selectWorkspace } =
    useSession();

  return (
    <>
      <p>{session.user?.name ?? "无用户"}</p>
      <p>{session.organization?.name ?? "无组织"}</p>
      <p>{session.workspace?.name ?? "无工作空间"}</p>
      <button onClick={() => selectUser("user-lead")}>选择用户</button>
      <button onClick={() => selectOrganization("org-guangwei")}>
        选择组织
      </button>
      <button onClick={() => selectWorkspace("ws-ai")}>选择工作空间</button>
    </>
  );
}

describe("SessionProvider", () => {
  it("tracks human identity and enterprise scope separately", async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <Harness />
      </SessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "选择用户" }));
    await user.click(screen.getByRole("button", { name: "选择组织" }));
    await user.click(screen.getByRole("button", { name: "选择工作空间" }));

    expect(screen.getByText("陈明")).toBeVisible();
    expect(screen.getByText("光位科技")).toBeVisible();
    expect(screen.getByText("AI 智能业务线")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test and verify the provider is missing**

```powershell
npm --prefix frontend test -- src/features/session/session-provider.test.tsx
```

Expected: FAIL because `session-provider.tsx` does not exist.

- [ ] **Step 3: Implement the session provider**

Create `frontend/src/features/session/session-provider.tsx`:

```tsx
"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { organization, users, workspace } from "@/mock/fixtures";
import type {
  OrganizationSummary,
  UserIdentity,
  WorkspaceSummary,
} from "@/types/domain";

interface SessionState {
  user?: UserIdentity;
  organization?: OrganizationSummary;
  workspace?: WorkspaceSummary;
}

interface SessionContextValue {
  session: SessionState;
  selectUser: (userId: string) => void;
  selectOrganization: (organizationId: string) => void;
  selectWorkspace: (workspaceId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({});

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      selectUser(userId) {
        const user = users.find((candidate) => candidate.id === userId);
        if (!user) throw new Error("User not found");
        setSession((current) => ({ ...current, user }));
      },
      selectOrganization(organizationId) {
        if (organizationId !== organization.id) {
          throw new Error("Organization not found");
        }
        setSession((current) => ({
          ...current,
          organization,
          workspace: undefined,
        }));
      },
      selectWorkspace(workspaceId) {
        if (workspaceId !== workspace.id) {
          throw new Error("Workspace not found");
        }
        setSession((current) => ({ ...current, workspace }));
      },
    }),
    [session],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
```

- [ ] **Step 4: Compose the provider at the application root**

Create `frontend/src/app/providers.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { SessionProvider } from "@/features/session/session-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Wrap `{children}` with `<Providers>` in `frontend/src/app/layout.tsx` and set metadata:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AIOS",
  description: "企业 AI 工作操作系统",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Implement the three selection pages**

Create `frontend/src/app/login/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { users } from "@/mock/fixtures";
import { useSession } from "@/features/session/session-provider";

export default function LoginPage() {
  const router = useRouter();
  const { selectUser } = useSession();

  return (
    <main className="min-h-screen bg-[#F5F7FB] p-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold text-indigo-600">AIOS</p>
        <h1 className="mt-2 text-3xl font-semibold">选择 Mock 身份</h1>
        <p className="mt-2 text-[#667085]">
          人类用户与 AI 员工使用独立身份和责任边界。
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <Card key={user.id} className="p-5">
              <h2 className="font-semibold">{user.name}</h2>
              <p className="mt-1 text-sm text-[#667085]">{user.role}</p>
              <button
                aria-label={`使用 ${user.name}（${user.role}）身份`}
                className="mt-5 min-h-11 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white"
                onClick={() => {
                  selectUser(user.id);
                  router.push("/organizations");
                }}
              >
                使用此身份
              </button>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
```

Create `frontend/src/app/organizations/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { organization } from "@/mock/fixtures";
import { useSession } from "@/features/session/session-provider";

export default function OrganizationsPage() {
  const router = useRouter();
  const { session, selectOrganization } = useSession();

  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F7FB] p-8">
      <Card className="w-full max-w-xl p-7">
        <p className="text-sm text-[#667085]">当前用户：{session.user?.name}</p>
        <h1 className="mt-2 text-3xl font-semibold">选择 Organization</h1>
        <button
          className="mt-8 w-full rounded-xl border border-slate-200 p-5 text-left hover:border-indigo-400"
          onClick={() => {
            selectOrganization(organization.id);
            router.push("/workspaces");
          }}
        >
          <span className="block font-semibold">{organization.name}</span>
          <span className="mt-1 block text-sm text-[#667085]">
            单公司、单租户 Mock 环境
          </span>
        </button>
      </Card>
    </main>
  );
}
```

Create `frontend/src/app/workspaces/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { workspace } from "@/mock/fixtures";
import { useSession } from "@/features/session/session-provider";

export default function WorkspacesPage() {
  const router = useRouter();
  const { session, selectWorkspace } = useSession();

  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F7FB] p-8">
      <Card className="w-full max-w-xl p-7">
        <p className="text-sm text-[#667085]">
          Organization：{session.organization?.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">选择 Workspace</h1>
        <button
          className="mt-8 w-full rounded-xl border border-slate-200 p-5 text-left hover:border-indigo-400"
          onClick={() => {
            selectWorkspace(workspace.id);
            router.push("/workspace");
          }}
        >
          <span className="block font-semibold">{workspace.name}</span>
          <span className="mt-1 block text-sm text-[#667085]">
            {workspace.purpose}
          </span>
        </button>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Run session tests and quality checks**

```powershell
npm --prefix frontend test -- src/features/session/session-provider.test.tsx
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

Expected: all commands exit with code 0.

- [ ] **Step 7: Commit identity and scope selection**

```powershell
git add frontend/src/app frontend/src/features/session
git commit -m "feat(frontend): add identity and workspace selection"
```

### Task 5: Build the complete README-aligned application shell

**Files:**
- Create: `frontend/src/config/navigation.ts`
- Create: `frontend/src/components/layout/sidebar.tsx`
- Create: `frontend/src/components/layout/topbar.tsx`
- Create: `frontend/src/components/layout/app-shell.tsx`
- Create: `frontend/src/components/layout/sidebar.test.tsx`
- Create: `frontend/src/app/(app)/layout.tsx`

- [ ] **Step 1: Write the failing navigation test**

Create `frontend/src/components/layout/sidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
}));

describe("Sidebar", () => {
  it("shows every approved navigation group", () => {
    render(<Sidebar />);

    expect(screen.getByText("工作")).toBeVisible();
    expect(screen.getByText("AI 资源")).toBeVisible();
    expect(screen.getByText("企业连接")).toBeVisible();
    expect(screen.getByText("管理与治理")).toBeVisible();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByText("MCP 连接")).toBeVisible();
    expect(screen.getByText("Plugin 管理")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test and verify the shell is missing**

```powershell
npm --prefix frontend test -- src/components/layout/sidebar.test.tsx
```

Expected: FAIL because `sidebar.tsx` does not exist.

- [ ] **Step 3: Define navigation without adding core modules**

Create `frontend/src/config/navigation.ts`:

```ts
export interface NavigationItem {
  label: string;
  href: string;
  enabled: boolean;
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
      { label: "工作台", href: "/workspace", enabled: true },
      { label: "Task", href: "/tasks", enabled: false },
      { label: "审批待办", href: "/approvals", enabled: false, badge: 3 },
      { label: "Artifact", href: "/artifacts", enabled: false },
    ],
  },
  {
    label: "AI 资源",
    items: [
      { label: "AI 员工", href: "/agents", enabled: false },
      { label: "Knowledge", href: "/knowledge", enabled: false },
      { label: "Capability", href: "/capabilities", enabled: false },
      { label: "Workflow", href: "/workflows", enabled: false },
    ],
  },
  {
    label: "企业连接",
    items: [
      { label: "Tool", href: "/tools", enabled: false },
      { label: "MCP 连接", href: "/tools/mcp", enabled: false },
      { label: "Plugin 管理", href: "/plugins", enabled: false },
    ],
  },
  {
    label: "管理与治理",
    items: [
      { label: "Organization", href: "/organization", enabled: false },
      { label: "成员与权限", href: "/members", enabled: false },
      { label: "Audit", href: "/audit", enabled: false },
    ],
  },
];
```

- [ ] **Step 4: Implement the sidebar**

Create `frontend/src/components/layout/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-[248px] shrink-0 bg-[#0B1220] px-4 py-5 text-white lg:block">
      <div className="px-2">
        <p className="text-2xl font-bold tracking-tight">AIOS</p>
        <p className="mt-1 text-xs text-slate-400">企业 AI 工作操作系统</p>
      </div>
      <nav className="mt-7 space-y-6" aria-label="主要导航">
        {navigation.map((group) => (
          <section key={group.label}>
            <h2 className="px-2 text-xs font-medium text-slate-500">
              {group.label}
            </h2>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    {item.enabled ? (
                      <Link
                        href={item.href}
                        className={cn(
                          "flex min-h-10 items-center justify-between rounded-lg px-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white",
                          active && "bg-indigo-600 text-white",
                        )}
                      >
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-red-500 px-2 text-xs">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <span
                        className="flex min-h-10 cursor-not-allowed items-center justify-between rounded-lg px-3 text-sm text-slate-500"
                        aria-disabled="true"
                        title="该模块将在对应实施阶段启用"
                      >
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-red-500/50 px-2 text-xs">
                            {item.badge}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 5: Implement top bar and shell**

Create `frontend/src/components/layout/topbar.tsx`:

```tsx
"use client";

import { Bell, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/session/session-provider";

export function Topbar() {
  const { session } = useSession();

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-7">
      <div className="flex items-center gap-3 text-sm">
        <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
          {session.organization?.name ?? "光位科技"}
          <ChevronDown aria-hidden size={16} />
        </button>
        <button className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3">
          {session.workspace?.name ?? "AI 智能业务线"}
          <ChevronDown aria-hidden size={16} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <Button className="hidden sm:inline-flex">
          <Plus aria-hidden size={17} />
          创建 Task
        </Button>
        <button
          className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-slate-100"
          aria-label="通知"
        >
          <Bell aria-hidden size={19} />
        </button>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold">{session.user?.name ?? "陈明"}</p>
          <p className="text-xs text-[#667085]">
            {session.user?.role ?? "研发负责人"}
          </p>
        </div>
      </div>
    </header>
  );
}
```

Create `frontend/src/components/layout/app-shell.tsx`:

```tsx
import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main className="p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
```

Create `frontend/src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 6: Run shell tests and quality checks**

```powershell
npm --prefix frontend test -- src/components/layout/sidebar.test.tsx
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

Expected: all commands exit with code 0.

- [ ] **Step 7: Commit the application shell**

```powershell
git add frontend/src/config frontend/src/components/layout 'frontend/src/app/(app)/layout.tsx'
git commit -m "feat(frontend): add README-aligned AIOS navigation"
```

### Task 6: Build the Workspace dashboard

**Files:**
- Create: `frontend/src/features/workspace/metric-card.tsx`
- Create: `frontend/src/features/workspace/dashboard-screen.tsx`
- Create: `frontend/src/features/workspace/dashboard-screen.test.tsx`
- Create: `frontend/src/app/(app)/workspace/page.tsx`

- [ ] **Step 1: Write the failing dashboard test**

Create `frontend/src/features/workspace/dashboard-screen.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { workspaceDashboard } from "@/mock/fixtures";
import { DashboardScreen } from "./dashboard-screen";

describe("DashboardScreen", () => {
  it("centers work, AI employee responsibility, and Artifact review", () => {
    render(<DashboardScreen snapshot={workspaceDashboard} />);

    expect(
      screen.getByRole("heading", { name: "Workspace 工作台" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "AI 研发员工" }),
    ).toBeVisible();
    expect(screen.getByText("责任人：陈明")).toBeVisible();
    expect(screen.getByText("待验收 Artifact")).toBeVisible();

    const quickActions = screen.getByRole("region", { name: "快速创建" });
    expect(within(quickActions).getAllByRole("button")).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run the test and verify dashboard components are missing**

```powershell
npm --prefix frontend test -- src/features/workspace/dashboard-screen.test.tsx
```

Expected: FAIL because `DashboardScreen` does not exist.

- [ ] **Step 3: Implement the metric card**

Create `frontend/src/features/workspace/metric-card.tsx`:

```tsx
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[#667085]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#172033]">{value}</p>
    </Card>
  );
}
```

- [ ] **Step 4: Implement the complete dashboard composition**

Create `frontend/src/features/workspace/dashboard-screen.tsx`:

```tsx
import { ArrowRight, Bot, FileCheck2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WorkspaceDashboard } from "@/types/domain";
import { MetricCard } from "./metric-card";

export function DashboardScreen({
  snapshot,
}: {
  snapshot: WorkspaceDashboard;
}) {
  const { metrics, agent, quickActions, tasks, todos, risks, currentUser } =
    snapshot;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Workspace 工作台
          </h1>
          <p className="mt-2 text-sm text-[#667085]">
            当前职责：{currentUser.role}
          </p>
        </div>
        <Button>创建 Task</Button>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="我的待办" value={metrics.todo} />
        <MetricCard label="进行中 Task" value={metrics.runningTasks} />
        <MetricCard label="可用 AI 员工" value={metrics.availableAgents} />
        <MetricCard
          label="待验收 Artifact"
          value={metrics.pendingArtifacts}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="grid size-14 place-items-center rounded-xl bg-cyan-600 text-white">
                  <Bot aria-hidden />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{agent.name}</h2>
                    <Badge tone="success">{agent.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[#667085]">
                    责任人：{agent.owner}
                  </p>
                  <p className="mt-1 text-sm text-[#667085]">
                    自治等级：{agent.autonomyLevel}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-2xl font-semibold">
                    {agent.completedToday}
                  </p>
                  <p className="text-xs text-[#667085]">今日完成</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">
                    {agent.runningTasks}
                  </p>
                  <p className="text-xs text-[#667085]">运行中</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">
                    {agent.artifactsProduced}
                  </p>
                  <p className="text-xs text-[#667085]">累计 Artifact</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5" aria-label="快速创建">
            <h2 className="font-semibold">快速创建</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="min-h-24 rounded-lg border border-slate-200 px-3 text-sm font-medium hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">最近 Task</h2>
              <button className="flex items-center gap-1 text-sm font-semibold text-indigo-600">
                查看全部 <ArrowRight aria-hidden size={16} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-t border-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-[#667085]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Task</th>
                    <th className="px-5 py-3 font-medium">类型</th>
                    <th className="px-5 py-3 font-medium">AI 员工</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-medium">{task.title}</td>
                      <td className="px-5 py-3 text-[#667085]">{task.type}</td>
                      <td className="px-5 py-3">{task.agentName}</td>
                      <td className="px-5 py-3">
                        <Badge tone={task.tone}>{task.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-[#667085]">
                        {task.updatedAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">我的待办</h2>
              <Badge tone="info">{metrics.todo}</Badge>
            </div>
            <ul className="mt-4 divide-y divide-slate-100">
              {todos.map((todo) => (
                <li key={todo.id} className="flex gap-3 py-4">
                  <FileCheck2
                    className="mt-0.5 shrink-0 text-indigo-600"
                    aria-hidden
                    size={19}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{todo.title}</p>
                    <p className="mt-1 text-xs text-[#667085]">
                      {todo.artifactType}
                    </p>
                  </div>
                  <button className="text-sm font-semibold text-indigo-600">
                    {todo.action}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">风险提示</h2>
            <ul className="mt-4 space-y-3">
              {risks.map((risk) => (
                <li
                  key={risk.id}
                  className="flex gap-3 rounded-lg bg-slate-50 p-3"
                >
                  <ShieldAlert
                    className={
                      risk.tone === "error"
                        ? "text-[#C4320A]"
                        : "text-[#B54708]"
                    }
                    aria-hidden
                    size={19}
                  />
                  <div>
                    <p className="text-sm font-semibold">{risk.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      {risk.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Connect the dashboard route to the Mock boundary**

Create `frontend/src/app/(app)/workspace/page.tsx`:

```tsx
import { DashboardScreen } from "@/features/workspace/dashboard-screen";
import { getWorkspaceDashboard } from "@/mock/repository";

export default async function WorkspacePage() {
  const snapshot = await getWorkspaceDashboard("ws-ai");

  return <DashboardScreen snapshot={snapshot} />;
}
```

- [ ] **Step 6: Run dashboard tests and quality checks**

```powershell
npm --prefix frontend test -- src/features/workspace/dashboard-screen.test.tsx
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

Expected: all commands exit with code 0 and Next.js generates `/workspace`.

- [ ] **Step 7: Commit the Workspace dashboard**

```powershell
git add frontend/src/features/workspace 'frontend/src/app/(app)/workspace'
git commit -m "feat(frontend): add Workspace dashboard"
```

### Task 7: Add browser-level golden-path verification

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/tests/workspace-dashboard.spec.ts`

- [ ] **Step 1: Add Playwright browser support**

```powershell
npm --prefix frontend exec -- playwright install chromium
```

Expected: Chromium installation exits with code 0.

- [ ] **Step 2: Create the browser configuration**

Create `frontend/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [ ] **Step 3: Write the browser flow**

Create `frontend/tests/workspace-dashboard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("研发负责人 enters the Workspace dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "进入 AIOS" }).click();
  await page
    .getByRole("button", { name: "使用 陈明（研发负责人）身份" })
    .click();
  await page.getByRole("button", { name: /光位科技/ }).click();
  await page.getByRole("button", { name: /AI 智能业务线/ }).click();

  await expect(
    page.getByRole("heading", { name: "Workspace 工作台" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI 研发员工" }),
  ).toBeVisible();
  await expect(page.getByText("责任人：陈明")).toBeVisible();
  await expect(page.getByText("待验收 Artifact")).toBeVisible();
});

test("complete AIOS navigation communicates module ownership", async ({
  page,
}) => {
  await page.goto("/workspace");

  await expect(page.getByText("Knowledge")).toBeVisible();
  await expect(page.getByText("Capability")).toBeVisible();
  await expect(page.getByText("Workflow")).toBeVisible();
  await expect(page.getByText("Tool", { exact: true })).toBeVisible();
  await expect(page.getByText("MCP 连接")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByText("Plugin 管理")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByText("Audit")).toBeVisible();
});
```

- [ ] **Step 4: Run the browser tests**

```powershell
npm --prefix frontend run test:e2e
```

Expected: both Chromium tests PASS.

- [ ] **Step 5: Commit browser verification**

```powershell
git add frontend/playwright.config.ts frontend/tests
git commit -m "test(frontend): verify Workspace browser flow"
```

### Task 8: Run the release gate for the first increment

**Files:**
- Modify only files required by failures discovered in this task

- [ ] **Step 1: Run the complete frontend gate**

```powershell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
npm --prefix frontend run build
```

Expected: every command exits with code 0.

- [ ] **Step 2: Check the approved architecture boundaries**

```powershell
rg -n "Chat|聊天机器人|apiKey|accessToken|clientSecret" frontend/src
rg -n "MCP 连接|Plugin 管理|Knowledge|Capability|Workflow|Tool|Audit" frontend/src/config/navigation.ts
git status --short
```

Expected:

- no chat-oriented product surface is present;
- no plaintext credential field is present;
- all approved navigation labels are present;
- `README.md` and existing architecture documents have no changes caused by this implementation;
- only intended frontend files are changed.

- [ ] **Step 3: Review the application at desktop and tablet widths**

Run:

```powershell
npm --prefix frontend run dev
```

Open:

- `http://127.0.0.1:3000/workspace` at 1440×900;
- `http://127.0.0.1:3000/workspace` at 1024×768.

Expected:

- desktop shows full navigation, four metrics, Agent card, six quick actions, Task table, pending work, and risks;
- tablet content remains readable with no clipped actions or inaccessible content;
- all status information includes text;
- keyboard focus is visible.

- [ ] **Step 4: Commit release-gate corrections if any**

If Task 8 required code corrections:

```powershell
git add frontend
git commit -m "fix(frontend): satisfy Workspace release gate"
```

If no correction was required, do not create an empty commit.

## 4. Definition of Done

- Next.js application starts locally;
- entry, identity, Organization, Workspace, and dashboard routes work;
- complete navigation reflects README and the approved design;
- disabled navigation entries explain implementation status and do not lead to empty routes;
- Workspace dashboard matches the approved enterprise-console direction;
- Task and Artifact are more prominent than conversation;
- AI 研发员工 shows status, L1 autonomy, and human responsibility;
- Mock data is typed, deterministic, tenant-scoped, and free of plaintext credentials;
- component, unit, browser, type, lint, and build checks pass;
- root `README.md` and all existing architecture documents remain unchanged.
