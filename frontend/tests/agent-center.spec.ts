import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

const SCREENSHOT_DIRECTORY = join(process.cwd(), "test-results");

async function enterWorkspace(
  page: Page,
  identity:
    | "使用陈明（研发负责人）身份"
    | "使用赵岚（审计员）身份",
) {
  await page.goto("/");
  await page.getByRole("link", { name: "进入 AIOS", exact: true }).click();
  await page.getByRole("button", { name: identity, exact: true }).click();
  await page
    .getByRole("button", { name: "选择组织光位科技", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "选择工作空间 AI 智能业务线",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
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

async function fillTaskDefinition(page: Page) {
  await page.getByRole("radio", { name: /生成技术方案/ }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page
    .getByLabel("任务标题", { exact: true })
    .fill("验证动态 AI 员工选择");
  await page
    .getByLabel("目标", { exact: true })
    .fill("验证任务固定已发布 AI 员工版本");
  await page
    .getByLabel("当前问题", { exact: true })
    .fill("执行身份此前由页面固定");
  await page
    .getByLabel("任务范围", { exact: true })
    .fill("AI 员工 Center 与任务中心公共契约");
  await page.getByLabel("不做事项", { exact: true }).fill("不调用真实模型");
  await page
    .getByLabel("约束", { exact: true })
    .fill("仅使用已启用 AI 员工与已发布版本");
  await page
    .getByLabel("期望完成时间", { exact: true })
    .fill("2026-08-01T18:00");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
}

test("AI 员工构建器完成草稿、测试、发布并供任务固定选择", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page, "使用陈明（研发负责人）身份");

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await navigation
    .getByRole("link", { name: "AI 员工", exact: true })
    .click();
  await expect(page).toHaveURL(/\/agents$/);
  await expect(
    page.getByRole("heading", { name: "AI 员工中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("AI 研发员工", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("agent-rd-001-v1", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "agent-center-mvp.png"),
    fullPage: true,
  });

  await page
    .getByRole("link", { name: "创建 AI 员工", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "创建 AI 员工草稿", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("AI 员工编码", { exact: true })
    .fill("AI_SOLUTION_ARCHITECT");
  await page
    .getByLabel("AI 员工名称", { exact: true })
    .fill("AI 解决方案架构师");
  await page
    .getByLabel("岗位名称", { exact: true })
    .fill("AI 解决方案架构师");
  await page
    .getByLabel("角色说明", { exact: true })
    .fill("读取授权上下文，生成由人工负责人验收的技术方案成果。");
  await page.getByRole("button", { name: "创建草稿", exact: true }).click();

  await expect(page).toHaveURL(/\/agents\/agent-custom-004$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", {
      name: "AI 解决方案架构师",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("草稿", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "运行确定性测试", exact: true })
    .click();
  await expect(page.getByText("测试中", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("已通过", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "发布并启用", exact: true })
    .click();
  await expect(page.getByText("已启用", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("已发布", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "agent-detail-mvp.png"),
    fullPage: true,
  });

  await page.goto("/tasks/new");
  await fillTaskDefinition(page);
  const customAgent = page.getByRole("radio", {
    name: /AI 解决方案架构师 · v1/,
  });
  await expect(customAgent).toBeVisible();
  await customAgent.check();
  await expect(
    page.getByText("agent-custom-004-v1", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /技术方案生成 · v1/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page
    .getByLabel("完成标准", { exact: true })
    .fill(
      "成果章节结构完整\n知识库引用可追溯到固定版本\nHuman 负责人完成人工验收",
    );
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(
    page.getByText("AI 解决方案架构师（agent-custom-004）", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("agent-custom-004-v1", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "提交任务", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/task-mock-0001$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", {
      name: "验证动态 AI 员工选择",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("AI 解决方案架构师", { exact: true }).first(),
  ).toBeVisible();
});

test("AI 员工中心对审计员保持只读", async ({ page }) => {
  await enterWorkspace(page, "使用赵岚（审计员）身份");
  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "AI 员工中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "创建 AI 员工", exact: true }),
  ).toHaveCount(0);

  await page.goto("/agents/new");
  await expect(
    page.getByRole("heading", {
      name: "当前身份不能创建 AI 员工",
      exact: true,
    }),
  ).toBeVisible();
});

test("AI 员工中心在移动视口没有页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWorkspace(page, "使用陈明（研发负责人）身份");
  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "AI 员工中心", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.goto("/agents/agent-rd-001");
  await expect(
    page.getByRole("heading", { name: "AI 研发员工", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
});
