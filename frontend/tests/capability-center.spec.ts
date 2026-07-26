import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";

const SCREENSHOT_DIRECTORY = join(process.cwd(), "test-results");

async function enterWorkspace(
  page: Page,
  identity:
    | "使用 陈明（研发负责人）身份"
    | "使用 赵岚（Auditor）身份",
) {
  await page.goto("/");
  await page.getByRole("link", { name: "进入 AIOS", exact: true }).click();
  await page.getByRole("button", { name: identity, exact: true }).click();
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

test("Capability Builder 完成 Draft、评测、Review、发布并供 Task 选择", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page, "使用 陈明（研发负责人）身份");

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await navigation
    .getByRole("link", { name: "能力中心", exact: true })
    .click();
  await expect(page).toHaveURL(/\/capabilities$/);
  await expect(
    page.getByRole("heading", { name: "能力中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("技术方案生成", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("capability-technical-solution-v1", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "capability-center-mvp.png"),
    fullPage: true,
  });

  await page
    .getByRole("link", { name: "创建能力", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "创建能力 Draft", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Capability Code", { exact: true })
    .fill("TECHNICAL_RESEARCH");
  await page.getByLabel("能力名称", { exact: true }).fill("技术调研");
  await page
    .getByLabel("Purpose", { exact: true })
    .fill("读取授权上下文并生成可评审、可追溯的技术调研方案。");
  await page
    .getByLabel("PromptTemplateRef", { exact: true })
    .fill("prompt-technical-research");
  await page
    .getByLabel("WorkflowVersionRef", { exact: true })
    .fill("workflow-technical-research");
  await page
    .getByLabel("Tool Action（可选）", { exact: true })
    .fill("codegraph.context");
  await page.getByRole("button", { name: "创建 Draft", exact: true }).click();

  await expect(page).toHaveURL(/\/capabilities\/capability-custom-005$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "技术调研", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "运行 Mock 评测", exact: true })
    .click();
  await expect(page.getByText("In Review", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("PASSED", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Review 并发布", exact: true })
    .click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "capability-detail-mvp.png"),
    fullPage: true,
  });

  await page.goto("/agents/new");
  await page
    .getByLabel("Agent Code", { exact: true })
    .fill("AI_RESEARCH_ENGINEER");
  await page
    .getByLabel("AI 员工名称", { exact: true })
    .fill("AI 技术调研员工");
  await page
    .getByLabel("Job Title", { exact: true })
    .fill("AI 技术调研员工");
  await page
    .getByLabel("Role Description", { exact: true })
    .fill("使用已绑定的 Published CapabilityVersion 生成技术调研方案。");
  await page.getByRole("button", { name: "创建 Draft", exact: true }).click();
  await page
    .getByRole("button", { name: "运行确定性测试", exact: true })
    .click();
  await expect(page.getByText("PASSED", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "发布并启用", exact: true })
    .click();
  await expect(page.getByText("ENABLED", { exact: true }).first()).toBeVisible();

  await page.goto("/tasks/new");
  await page.getByRole("radio", { name: /生成技术方案/ }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByLabel("Task 标题", { exact: true }).fill("验证动态能力选择");
  await page.getByLabel("Goal", { exact: true }).fill("验证 Task 固定已发布能力版本");
  await page.getByLabel("当前问题", { exact: true }).fill("能力引用此前由页面硬编码");
  await page.getByLabel("任务范围", { exact: true }).fill("Task 与 Capability 公共契约");
  await page.getByLabel("不做事项", { exact: true }).fill("不调用真实模型");
  await page.getByLabel("约束", { exact: true }).fill("仅使用 Published 版本");
  await page.getByLabel("期望完成时间", { exact: true }).fill("2026-08-01T18:00");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page
    .getByRole("radio", { name: /AI 技术调研员工 · v1/ })
    .check();
  await expect(
    page.getByRole("radio", { name: /技术调研 · v1/ }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /技术调研 · v1/ }).check();
  await expect(
    page.getByText("capability-custom-005-v1", { exact: true }),
  ).toBeVisible();
});

test("能力中心对 Auditor 保持只读", async ({ page }) => {
  await enterWorkspace(page, "使用 赵岚（Auditor）身份");
  await page.goto("/capabilities");
  await expect(
    page.getByRole("heading", { name: "能力中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "创建能力", exact: true }),
  ).toHaveCount(0);

  await page.goto("/capabilities/new");
  await expect(
    page.getByRole("heading", { name: "当前身份不能创建能力", exact: true }),
  ).toBeVisible();
});

test("能力中心在移动视口没有页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWorkspace(page, "使用 陈明（研发负责人）身份");
  await page.goto("/capabilities");
  await expect(
    page.getByRole("heading", { name: "能力中心", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.goto("/capabilities/capability-technical-solution");
  await expect(
    page.getByRole("heading", { name: "技术方案生成", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
});
