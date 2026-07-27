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

test("知识库管理者完成注册、发布、检索、版本替代与纠错闭环", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page, "使用陈明（研发负责人）身份");

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await navigation
    .getByRole("link", { name: "知识库", exact: true })
    .click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(
    page.getByRole("heading", { name: "知识库", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "新增 / 导入知识", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("AIOS 项目文档", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("knowledge-aios-docs-v1", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "knowledge-center-mvp.png"),
    fullPage: true,
  });

  await page
    .getByRole("link", { name: "新增 / 导入知识", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "新增知识", exact: true }),
  ).toBeVisible();
  await page.getByLabel("知识库编码", { exact: true }).fill(
    "release-verification-guide",
  );
  await page
    .getByLabel("标题", { exact: true })
    .fill("发布校验指南");
  await page
    .getByLabel("描述", { exact: true })
    .fill("用于研发任务的发布校验、回退验证与证据留存。");
  await page.getByLabel("来源类型", { exact: true }).selectOption("SOP");
  await page
    .getByLabel("来源位置", { exact: true })
    .fill("docs/engineering/release-verification.md");
  await page
    .getByLabel("来源权威性", { exact: true })
    .fill("经研发负责人审批的正式发布规范");
  await page.getByLabel("敏感等级", { exact: true }).selectOption("INTERNAL");
  await page
    .getByLabel("文件名", { exact: true })
    .fill("release-verification.md");
  await page
    .getByLabel("知识正文", { exact: true })
    .fill(
      "# 发布校验\n\n发布前必须执行类型检查、单元测试和构建验证。发布后核对引用与成果证据，异常时按回退清单恢复。",
    );
  await page.getByRole("button", { name: "注册知识", exact: true }).click();

  await expect(page).toHaveURL(/\/knowledge\/knowledge-mock-0001$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "发布校验指南", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-knowledge-effective-status="DRAFT"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-knowledge-index-status="READY"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "发布为有效版本", exact: true })
    .click();
  await expect(
    page.locator('[data-knowledge-effective-status="EFFECTIVE"]'),
  ).toBeVisible();

  await page.goto("/knowledge/retrieval");
  await expect(
    page.getByRole("heading", { name: "知识库检索", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("检索问题", { exact: true })
    .fill("发布校验回退引用");
  await page.getByRole("button", { name: "执行检索", exact: true }).click();
  await expect(page.getByText("发布校验指南", { exact: true })).toBeVisible();
  await expect(
    page.getByText("knowledge-mock-0001-v1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("引用摘要", { exact: true }).first(),
  ).toBeVisible();

  await page.goto("/knowledge/knowledge-mock-0001");
  await page
    .getByRole("link", { name: "创建新版本", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "创建新版本", exact: true }),
  ).toBeVisible();
  await page.getByLabel("文件名", { exact: true }).fill("release-verification-v2.md");
  await page
    .getByLabel("知识正文", { exact: true })
    .fill(
      "# 发布校验 v2\n\n发布前执行类型检查、单元测试、E2E 与生产构建。发布后验证权限负向用例、固定知识库版本引用和成果，异常时执行已评审回退步骤。",
    );
  await page.getByRole("button", { name: "创建草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge\/knowledge-mock-0001$/);
  await expect(page.getByText("knowledge-mock-0001-v2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "发布为有效版本", exact: true })
    .click();
  await expect(
    page.locator('[data-knowledge-effective-status="EFFECTIVE"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-knowledge-effective-status="INVALIDATED"]'),
  ).toHaveCount(1);

  await page.getByLabel("目标版本", { exact: true }).selectOption(
    "knowledge-mock-0001-v2",
  );
  await page
    .getByLabel("纠错原因", { exact: true })
    .fill("补充生产发布后的监控观察窗口和责任人。");
  await page
    .getByLabel("证据引用", { exact: true })
    .fill("docs/reviews/release-review-2026-07.md");
  await page.getByRole("button", { name: "提交纠错", exact: true }).click();
  await expect(page.getByText("补充生产发布后的监控观察窗口和责任人。")).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "knowledge-detail-mvp.png"),
    fullPage: true,
  });
});

test("知识库对审计员保持只读并隐藏机密条目", async ({
  page,
}) => {
  await enterWorkspace(page, "使用赵岚（审计员）身份");
  await page.goto("/knowledge");
  await expect(
    page.getByRole("heading", { name: "知识库", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "新增 / 导入知识", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("AI 安全基线（受限）", { exact: true }),
  ).toHaveCount(0);

  await page.goto("/knowledge/new");
  await expect(
    page.getByRole("heading", {
      name: "当前身份不能新增知识",
      exact: true,
    }),
  ).toBeVisible();
});

test("知识库在移动视口没有页面级横向溢出", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWorkspace(page, "使用陈明（研发负责人）身份");
  await page.goto("/knowledge");
  await expect(
    page.getByRole("heading", { name: "知识库", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.goto("/knowledge/knowledge-aios-docs");
  await expect(page.getByRole("heading", { name: "AIOS 项目文档" })).toBeVisible();
  await expectNoPageOverflow(page);
});
