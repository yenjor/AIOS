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

test("MCP Server 经过 Draft、测试、启用后才进入 Agent Builder", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page, "使用 陈明（研发负责人）身份");

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await navigation.getByRole("link", { name: "Tool", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tool 中心", exact: true }),
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
    page.getByText("CodeGraph 本地 MCP Server", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "mcp-center-mvp.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "注册 MCP Server" }).click();
  await page
    .getByLabel("Server Identity", { exact: true })
    .fill("aios.requirement.reader");
  await page
    .getByLabel("显示名称", { exact: true })
    .fill("需求文档 MCP Server");
  await page
    .getByLabel("Endpoint Reference", { exact: true })
    .fill("runtime://requirement-reader");
  await page
    .getByLabel("Tool Code", { exact: true })
    .fill("REQUIREMENT_READ");
  await page
    .getByLabel("Tool 名称", { exact: true })
    .fill("需求文档读取");
  await page
    .getByLabel("Tool 描述", { exact: true })
    .fill("读取当前 Workspace 授权的需求文档，不产生外部副作用。");
  await page
    .getByLabel("Action Name", { exact: true })
    .fill("requirement.read");
  await page
    .getByLabel("Action 描述", { exact: true })
    .fill("读取固定范围内的需求文档并返回结构化内容。");
  await page
    .getByLabel("SecretReference（可选）", { exact: true })
    .fill("secret://workspace/requirement-reader");
  await page
    .getByRole("button", { name: "创建 Draft Connection", exact: true })
    .click();

  await expect(page).toHaveURL(/\/tools\/mcp\/mcp-custom-0001$/, {
    timeout: 30_000,
  });
  await expect(page.getByText("DRAFT", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("UNKNOWN", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "运行连接测试", exact: true })
    .click();
  await expect(page.getByText("TESTING", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("PASSED", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "审核并启用", exact: true })
    .click();
  await expect(page.getByText("ENABLED", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("PUBLISHED", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: join(SCREENSHOT_DIRECTORY, "mcp-detail-mvp.png"),
    fullPage: true,
  });

  await page.goto("/agents/new");
  await expect(
    page.getByRole("heading", { name: "创建 AI 员工 Draft", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("requirement.read", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("tool-custom-0001-v1", { exact: false }),
  ).toBeVisible();
});

test("MCP 连接中心对 Auditor 保持只读", async ({ page }) => {
  await enterWorkspace(page, "使用 赵岚（Auditor）身份");
  await page.goto("/tools/mcp");
  await expect(
    page.getByRole("heading", { name: "MCP 连接中心", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "注册 MCP Server", exact: true }),
  ).toHaveCount(0);

  await page.goto("/tools/mcp/new");
  await expect(
    page.getByRole("heading", {
      name: "当前身份不能注册 MCP Server",
      exact: true,
    }),
  ).toBeVisible();
});

test("Tool 与 MCP 页面在移动视口没有页面级横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWorkspace(page, "使用 陈明（研发负责人）身份");
  await page.goto("/tools");
  await expect(
    page.getByRole("heading", { name: "Tool 中心", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await page.goto("/tools/mcp/mcp-codegraph-local");
  await expect(
    page.getByRole("heading", {
      name: "CodeGraph 本地 MCP Server",
      exact: true,
    }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
});
