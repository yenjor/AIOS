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

test("MCP 服务经过草稿、测试、启用后才进入 AI 员工构建器", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page, "使用陈明（研发负责人）身份");

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await navigation.getByRole("link", { name: "工具", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工具中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("CodeGraph 代码理解", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("tool-codegraph-read-v1", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "管理 MCP 连接" }).click();
  await expect(
    page.getByRole("heading", { name: "MCP 连接中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("CodeGraph 本地 MCP 服务", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "mcp-center-mvp.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "注册 MCP 服务" }).click();
  await page
    .getByLabel("服务身份", { exact: true })
    .fill("aios.requirement.reader");
  await page
    .getByLabel("显示名称", { exact: true })
    .fill("需求文档 MCP 服务");
  await page
    .getByLabel("端点引用", { exact: true })
    .fill("runtime://requirement-reader");
  await page
    .getByLabel("工具编码", { exact: true })
    .fill("REQUIREMENT_READ");
  await page
    .getByLabel("工具名称", { exact: true })
    .fill("需求文档读取");
  await page
    .getByLabel("工具描述", { exact: true })
    .fill("读取当前工作空间授权的需求文档，不产生外部副作用。");
  await page
    .getByLabel("动作名称", { exact: true })
    .fill("requirement.read");
  await page
    .getByLabel("动作描述", { exact: true })
    .fill("读取固定范围内的需求文档并返回结构化内容。");
  await page
    .getByLabel("密钥引用（可选）", { exact: true })
    .fill("secret://workspace/requirement-reader");
  await page
    .getByRole("button", { name: "创建草稿连接", exact: true })
    .click();

  await expect(page).toHaveURL(/\/tools\/mcp\/mcp-custom-0001$/, {
    timeout: 30_000,
  });
  await expect(page.getByText("草稿", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("未知", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "运行连接测试", exact: true })
    .click();
  await expect(page.getByText("测试中", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("已通过", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "审核并启用", exact: true })
    .click();
  await expect(page.getByText("已启用", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("已发布", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "mcp-detail-mvp.png"),
    fullPage: true,
  });

  await page.goto("/agents/new");
  await expect(
    page.getByRole("heading", { name: "创建 AI 员工草稿", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("requirement.read", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("tool-custom-0001-v1", { exact: false }),
  ).toBeVisible();
});

test("MCP 连接中心对审计员保持只读", async ({ page }) => {
  await enterWorkspace(page, "使用赵岚（审计员）身份");
  await page.goto("/tools/mcp");
  await expect(
    page.getByRole("heading", { name: "MCP 连接中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "注册 MCP 服务", exact: true }),
  ).toHaveCount(0);

  await page.goto("/tools/mcp/new");
  await expect(
    page.getByRole("heading", {
      name: "当前身份不能注册 MCP 服务",
      exact: true,
    }),
  ).toBeVisible();
});

test("工具与 MCP 页面在移动视口没有页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWorkspace(page, "使用陈明（研发负责人）身份");
  await page.goto("/tools");
  await expect(
    page.getByRole("heading", { name: "工具中心", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.goto("/tools/mcp/mcp-codegraph-local");
  await expect(
    page.getByRole("heading", {
      name: "CodeGraph 本地 MCP 服务",
      exact: true,
    }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
});
