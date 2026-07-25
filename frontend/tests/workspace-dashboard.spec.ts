import { expect, test, type Page } from "@playwright/test";

export async function enterWorkspaceAsLead(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "进入 AIOS", exact: true }).click();
  await page
    .getByRole("button", {
      name: "使用 陈明（研发负责人）身份",
      exact: true,
    })
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

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(
    page.getByRole("heading", { name: "Workspace 工作台", exact: true }),
  ).toBeVisible();
}

test("研发负责人通过真实选择流程进入 Workspace 工作台", async ({ page }) => {
  await enterWorkspaceAsLead(page);

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByText("当前职责：研发负责人", { exact: true })).toBeVisible();

  const agentRegion = page.getByRole("region", {
    name: "AI 研发员工",
    exact: true,
  });
  await expect(agentRegion.getByRole("heading", { name: "AI 研发员工" })).toBeVisible();
  await expect(agentRegion.getByText("责任人：陈明", { exact: true })).toBeVisible();

  const metrics = page.getByRole("region", {
    name: "Workspace 核心指标",
    exact: true,
  });
  const expectedMetrics = new Map([
    ["我的待办", "5"],
    ["进行中 Task", "12"],
    ["可用 AI 员工", "1"],
    ["待验收 Artifact", "3"],
  ]);

  for (const [name, value] of expectedMetrics) {
    const metric = metrics.getByRole("group", { name, exact: true });
    await expect(metric).toBeVisible();
    await expect(metric).toContainText(value);
  }

  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("完整导航保持 README 模块归属且只有工作台可进入", async ({ page }) => {
  await enterWorkspaceAsLead(page);

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  const expectedGroups = ["工作", "AI 资源", "企业连接", "管理与治理"];
  const expectedItems = [
    "工作台",
    "Task",
    "审批待办",
    "Artifact",
    "AI 员工",
    "Knowledge",
    "Capability",
    "Workflow",
    "Tool",
    "MCP 连接",
    "Plugin 管理",
    "Organization",
    "成员与权限",
    "Audit",
  ];

  for (const group of expectedGroups) {
    await expect(
      navigation.getByRole("heading", { name: group, exact: true }),
    ).toBeAttached();
  }

  for (const item of expectedItems) {
    await expect(
      navigation.getByRole("link", { name: new RegExp(`^${item}(?:\\s|，|$)`) }),
    ).toBeAttached();
  }

  await expect(navigation.getByRole("link")).toHaveCount(14);
  await expect(navigation.locator("a[href]")).toHaveCount(1);

  const workspaceLink = navigation.getByRole("link", {
    name: "工作台",
    exact: true,
  });
  await expect(workspaceLink).toHaveAttribute("href", "/workspace");
  await expect(workspaceLink).toHaveAttribute("aria-current", "page");

  for (const item of expectedItems.slice(1)) {
    const disabledLink = navigation.getByRole("link", {
      name: new RegExp(`^${item}(?:\\s|，|$)`),
    });
    await expect(disabledLink).toHaveAttribute("aria-disabled", "true");
    await expect(disabledLink).not.toHaveAttribute("href", /.+/);
    await expect(disabledLink).toHaveJSProperty("tabIndex", -1);
  }

  const approvalLink = navigation.getByRole("link", { name: /^审批待办/ });
  await expect(approvalLink).toContainText("3");

  const enterpriseConnections = navigation
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "企业连接",
        exact: true,
      }),
    });
  await expect(
    enterpriseConnections.getByRole("link", {
      name: "MCP 连接",
      exact: true,
    }),
  ).toBeAttached();
  await expect(
    enterpriseConnections.getByRole("link", {
      name: "Plugin 管理",
      exact: true,
    }),
  ).toBeAttached();
  await expect(enterpriseConnections.getByRole("link")).toHaveCount(3);
});

test.describe("移动导航", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("抽屉隔离背景并支持当前导航和 Escape 关闭", async ({ page }) => {
    await enterWorkspaceAsLead(page);

    const navigationTrigger = page.getByRole("button", {
      name: "打开主导航",
      exact: true,
    });
    await navigationTrigger.click();

    const drawer = page.getByRole("dialog", {
      name: "AIOS 主导航",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");

    const background = page.getByTestId("app-shell-background");
    await expect(background).toHaveAttribute("aria-hidden", "true");
    await expect(background).toHaveJSProperty("inert", true);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    await drawer
      .getByRole("link", { name: "工作台", exact: true })
      .click();
    await expect(drawer).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");

    await navigationTrigger.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(navigationTrigger).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");
  });
});
