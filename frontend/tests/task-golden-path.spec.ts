import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

const SCREENSHOT_DIRECTORY = join(process.cwd(), "test-results");
const GOLDEN_TITLE = "为 AIOS Task Center 生成技术方案";
const CONTROLLED_ACTIONS = [
  "补充信息",
  "批准计划",
  "驳回计划",
  "要求调整计划",
  "开始执行",
  "暂停",
  "恢复",
  "取消",
  "人工接管",
  "调用 Tool",
  "接受 Artifact",
  "驳回 Artifact",
  "要求 Artifact 返工",
] as const;

async function enterWorkspace(
  page: Page,
  identityButtonName:
    | "使用 林悦（产品经理）身份"
    | "使用 赵岚（Auditor）身份",
) {
  await page.goto("/");
  await page.getByRole("link", { name: "进入 AIOS", exact: true }).click();
  await page
    .getByRole("button", { name: identityButtonName, exact: true })
    .click();
  await page
    .getByRole("button", { name: "选择组织 光位科技", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "选择 Workspace AI 智能业务线",
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Workspace 工作台", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
}

async function expectCurrentWizardStep(page: Page, step: number, label: string) {
  await expect(
    page.getByRole("button", {
      name: `第 ${step} 步：${label}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "step");
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test("产品经理完成 Task 黄金路径并在刷新与列表检索后保持证据", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await enterWorkspace(page, "使用 林悦（产品经理）身份");

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await navigation.getByRole("link", { name: "Task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(
    page.getByRole("heading", { name: "Task Center", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Task 摘要" })).toBeVisible();
  await expect(page.getByRole("search", { name: "Task 筛选" })).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "task-center.png"),
    fullPage: true,
  });

  await page
    .getByRole("main")
    .getByRole("link", { name: "创建 Task", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await expect(
    page.getByRole("heading", { name: "创建 Task", exact: true }),
  ).toBeVisible();
  await expectCurrentWizardStep(page, 1, "选择模板");

  await page.getByRole("radio", { name: /生成技术方案/ }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expectCurrentWizardStep(page, 2, "定义工作");

  await page.getByLabel("Task 标题", { exact: true }).fill(GOLDEN_TITLE);
  await page
    .getByLabel("Goal", { exact: true })
    .fill("形成可评审、可实施、可追溯的 Task Center 技术方案");
  await page
    .getByLabel("当前问题", { exact: true })
    .fill("Task Center 已具备页面骨架，但需要通过受控 Task 闭环验证研发工作定义。");
  await page
    .getByLabel("任务范围", { exact: true })
    .fill("Task Center、Task 创建向导、Task 详情与固定 VersionRef 证据");
  await page
    .getByLabel("不做事项", { exact: true })
    .fill("不启动 Agent Runtime\n不调用真实 Tool\n不生成虚假 Artifact");
  await page
    .getByLabel("约束", { exact: true })
    .fill("遵循现有 Modular Monolith 架构\n保持 Workspace 权限边界\n仅使用固定版本引用");
  await page.getByLabel("Priority", { exact: true }).fill("50");
  await page.getByLabel("Risk", { exact: true }).selectOption("R1");
  await page
    .getByLabel("期望完成时间", { exact: true })
    .fill("2026-08-01T18:00");

  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(
    page.getByText("草稿已保存到当前 actor 与 Workspace 的隔离空间。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expectCurrentWizardStep(page, 2, "定义工作");
  await expect(page.getByLabel("Task 标题", { exact: true })).toHaveValue(
    GOLDEN_TITLE,
  );
  await expect(page.getByLabel("Risk", { exact: true })).toHaveValue("R1");

  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expectCurrentWizardStep(page, 3, "提供上下文");
  const knowledgeBinding = page.locator("#includeKnowledge");
  if (!(await knowledgeBinding.isChecked())) {
    await knowledgeBinding.check();
  }
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(
    page.getByText("草稿已保存到当前 actor 与 Workspace 的隔离空间。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expectCurrentWizardStep(page, 3, "提供上下文");
  await expect(knowledgeBinding).toBeChecked();
  await expect(page.getByText("knowledge-aios-docs-v1", { exact: true })).toBeVisible();

  const stepTwo = page.getByRole("button", {
    name: "第 2 步：定义工作",
    exact: true,
  });
  await stepTwo.focus();
  await page.keyboard.press("Enter");
  await expectCurrentWizardStep(page, 2, "定义工作");
  const stepThree = page.getByRole("button", {
    name: "第 3 步：提供上下文",
    exact: true,
  });
  await stepThree.focus();
  await page.keyboard.press("Space");
  await expectCurrentWizardStep(page, 3, "提供上下文");

  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expectCurrentWizardStep(page, 4, "定义成果");
  await expect(page.getByText("技术方案", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Reviewer：陈明（user-lead）", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "必须通过的检查", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Completion Criteria", { exact: true })
    .fill(
      "Artifact 章节结构完整\n知识库引用可追溯到固定版本\n陈明完成人工验收",
    );

  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expectCurrentWizardStep(page, 5, "确认执行");
  await expect(page.getByText("capability-technical-solution-v1", { exact: true })).toBeVisible();
  await expect(page.getByText("workflow-technical-solution-v1", { exact: true })).toBeVisible();
  await expect(page.getByText("tool-codegraph-read", { exact: true })).toBeVisible();
  await expect(page.getByText("codegraph.context", { exact: true })).toBeVisible();
  await expect(page.getByText("READ", { exact: true })).toBeVisible();
  await expect(page.getByText("L1辅助", { exact: false })).toBeVisible();
  await expect(page.getByText("计划确认", { exact: true })).toBeVisible();
  await expect(page.getByText("Artifact验收", { exact: true })).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "task-wizard.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "提交 Task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/task-mock-0001$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: GOLDEN_TITLE, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("待审批", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Task 详情导航" }).getByRole("link"),
  ).toHaveCount(6);

  const plan = page.getByRole("region", { name: "计划", exact: true });
  await expect(plan.getByLabel(/^步骤 \d+：/)).toHaveCount(5);
  await expect(plan.getByText("计划确认", { exact: true })).toBeVisible();
  await expect(plan.getByText("Artifact验收", { exact: true })).toBeVisible();
  const artifact = page.getByRole("region", {
    name: "Artifact",
    exact: true,
  });
  await expect(artifact.getByText("尚未生成", { exact: true })).toBeVisible();

  for (const action of CONTROLLED_ACTIONS) {
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toBeDisabled();
  }
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "task-detail.png"),
    fullPage: true,
  });

  await page.reload();
  await expect(
    page.getByRole("heading", { name: GOLDEN_TITLE, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("task-mock-0001", { exact: true })).toBeVisible();

  await page.goto("/tasks");
  await expect(
    page.getByRole("heading", { name: "Task Center", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索 Task" }).fill(GOLDEN_TITLE);
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  const createdTaskLink = page.getByRole("link", {
    name: "查看 Task task-mock-0001",
    exact: true,
  });
  await expect(createdTaskLink).toBeVisible();
  await createdTaskLink.click();
  await expect(page).toHaveURL(/\/tasks\/task-mock-0001$/);
  await expect(
    page.getByRole("heading", { name: GOLDEN_TITLE, exact: true }),
  ).toBeVisible();

  await page.evaluate(() => {
    window.sessionStorage.setItem(
      "aios.mock.session.v1",
      JSON.stringify({
        userId: "user-lead",
        organizationId: "org-guangwei",
        workspaceId: "ws-ai",
      }),
    );
  });
  await page.reload();
  await expect(page.getByText("陈明（研发负责人）", { exact: true })).toBeVisible();

  const approvePlan = page.getByRole("button", {
    name: "批准计划",
    exact: true,
  });
  await expect(approvePlan).toBeEnabled();
  await approvePlan.click();
  await expect(page.locator('[data-task-status="EXECUTING"]')).toBeVisible();
  await expect(
    page.getByText("ExecutionRun · 确定性 Mock Runtime", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("已完成 0 / 4 个 Runtime Step", { exact: true }),
  ).toBeVisible();

  const advanceRuntime = page.getByRole("button", {
    name: "开始执行",
    exact: true,
  });
  for (const completed of [1, 2, 3, 4]) {
    await expect(advanceRuntime).toBeEnabled();
    await advanceRuntime.click();
    if (completed < 4) {
      await expect(
        page.getByText(`已完成 ${completed} / 4 个 Runtime Step`, {
          exact: true,
        }),
      ).toBeVisible();
    }
  }

  await expect(page.locator('[data-task-status="REVIEW"]')).toBeVisible();
  await expect(
    page.getByText("4 个持久化检查点", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("第 5 步是 Human Review，不由 Agent Runtime 自动完成。", {
      exact: true,
    }),
  ).toBeVisible();

  const artifactLink = page.getByRole("link", {
    name: "查看 Artifact artifact-task-mock-0001",
    exact: true,
  });
  await expect(artifactLink).toBeVisible();
  await artifactLink.click();
  await expect(page).toHaveURL(
    /\/artifacts\/artifact-task-mock-0001$/,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: `${GOLDEN_TITLE} · 技术方案`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("PENDING_REVIEW", { exact: true })).toBeVisible();
  await expect(
    page.getByText("README.md#5-系统整体架构", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Artifact 等待 Reviewer 验收", { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "返回所属 Task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/task-mock-0001$/);
  const acceptArtifact = page.getByRole("button", {
    name: "接受 Artifact",
    exact: true,
  });
  await expect(acceptArtifact).toBeEnabled();
  await acceptArtifact.click();
  await expect(page.locator('[data-task-status="COMPLETED"]')).toBeVisible();
  await expect(page.getByText("技术方案 · 已接受", { exact: true })).toBeVisible();

  await page
    .getByRole("link", {
      name: "查看 Artifact artifact-task-mock-0001",
      exact: true,
    })
    .click();
  await expect(page.getByText("ACCEPTED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Artifact 已由 Reviewer 验收", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Accepted by user-lead/)).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "ai-employee-completed.png"),
    fullPage: true,
  });
});

test("Auditor 只能读取 Task 且所有创建入口与直达向导均被拒绝", async ({
  page,
}) => {
  await enterWorkspace(page, "使用 赵岚（Auditor）身份");

  await expect(page.locator('a[href="/tasks/new"]')).toHaveCount(0);
  await expect(page.getByRole("region", { name: "快速创建" })).toHaveCount(0);
  await expect(
    page.getByText("当前身份可查看 Task，但不能创建。", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "主要导航" })
    .getByRole("link", { name: "Task", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Task Center", exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href="/tasks/new"]')).toHaveCount(0);
  await expect(
    page.getByText("当前身份可查看 Task，但不能创建。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^查看 Task / }).first()).toBeVisible();

  await page.goto("/tasks/new");
  const denial = page.getByRole("alert");
  await expect(
    denial.getByRole("heading", {
      name: "当前身份不能创建 Task",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    denial.getByText(
      "当前身份在此 Organization 与 Workspace 中只有 Task 只读权限。系统未读取或写入任何个人草稿。",
      { exact: true },
    ),
  ).toBeVisible();
});

test("fresh Task responses never serialize protected Task fixtures", async ({
  request,
}) => {
  const routes = [
    "/tasks",
    "/tasks/new",
    "/tasks/task-golden-technical-solution",
    "/artifacts/artifact-task-mock-0001",
  ];
  const protectedNeedles = [
    "task-seed-",
    "生成 AIOS Task Center 技术方案",
    "plan-task-golden-technical-solution-v1",
    "knowledge-aios-docs-v1",
    "capability-technical-solution-v1",
  ];
  const responses = await Promise.all(
    routes.flatMap((route) => [
      request.get(route),
      request.get(route, { headers: { RSC: "1" } }),
    ]),
  );

  for (const response of responses) {
    const body = await response.text();
    expect(response.ok()).toBe(true);
    for (const needle of protectedNeedles) {
      expect(body).not.toContain(needle);
    }
  }
});

test.describe("Task 路由响应式布局", () => {
  test.describe("移动端", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("Task Center、创建向导与详情均不产生页面级横向溢出", async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await enterWorkspace(page, "使用 林悦（产品经理）身份");

      await page.goto("/tasks");
      await expect(
        page.getByRole("heading", { name: "Task Center", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("list", { name: "Task 移动端列表" }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Task 表格，可横向滚动" }),
      ).toBeHidden();
      await expectNoPageOverflow(page);

      await page.goto("/tasks/new");
      await expect(
        page.getByRole("heading", { name: "创建 Task", exact: true }),
      ).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto("/tasks/task-golden-technical-solution");
      await expect(
        page.getByRole("heading", {
          name: "生成 AIOS Task Center 技术方案",
          exact: true,
        }),
      ).toBeVisible();
      await expectNoPageOverflow(page);
    });
  });

  test.describe("平板端", () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test("宽表内部滚动且 Task 三个路由不产生页面级横向溢出", async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await enterWorkspace(page, "使用 林悦（产品经理）身份");

      await page.goto("/tasks");
      await expect(
        page.getByRole("heading", { name: "Task Center", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Task 表格，可横向滚动" }),
      ).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto("/tasks/new");
      await expect(
        page.getByRole("heading", { name: "创建 Task", exact: true }),
      ).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto("/tasks/task-golden-technical-solution");
      await expect(
        page.getByRole("heading", {
          name: "生成 AIOS Task Center 技术方案",
          exact: true,
        }),
      ).toBeVisible();
      await expectNoPageOverflow(page);
    });
  });
});
