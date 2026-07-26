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

  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Workspace 工作台", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
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

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Workspace 工作台", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "切换身份：陈明，研发负责人",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "重新选择 Organization：光位科技",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "重新选择 Workspace：AI 智能业务线",
      exact: true,
    }),
  ).toBeVisible();
});

test("fresh Workspace response never serializes protected dashboard data", async ({
  request,
}) => {
  const responses = await Promise.all([
    request.get("/workspace"),
    request.get("/workspace", { headers: { RSC: "1" } }),
  ]);

  for (const response of responses) {
    const body = await response.text();

    expect(response.ok()).toBe(true);
    expect(body).not.toContain("Workspace 工作台");
    expect(body).not.toContain("用户中心登录流程重构");
    expect(body).not.toContain("需求澄清不足");
  }
});

test.describe("平板导航", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("紧凑品牌不裁切且页面无横向溢出", async ({ page }) => {
    await enterWorkspaceAsLead(page);

    const brand = page.getByTestId("sidebar-brand");
    await expect(brand.getByText("A", { exact: true })).toBeVisible();
    await expect(brand.getByText("AIOS", { exact: true })).toBeHidden();

    const bounds = await brand.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(72);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});

test("完整导航保持 README 模块归属且工作台、Task 与知识库可进入", async ({ page }) => {
  await enterWorkspaceAsLead(page);

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  const expectedGroups = ["工作", "AI 资源", "企业连接", "管理与治理"];
  const expectedItems = [
    "工作台",
    "Task",
    "审批待办",
    "Artifact",
    "AI 员工",
    "知识库",
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
  await expect(navigation.locator("a[href]")).toHaveCount(3);

  const workspaceLink = navigation.getByRole("link", {
    name: "工作台",
    exact: true,
  });
  await expect(workspaceLink).toHaveAttribute("href", "/workspace");
  await expect(workspaceLink).toHaveAttribute("aria-current", "page");

  const taskLink = navigation.getByRole("link", {
    name: "Task",
    exact: true,
  });
  await expect(taskLink).toHaveAttribute("href", "/tasks");
  await expect(taskLink).not.toHaveAttribute("aria-disabled", "true");

  const knowledgeLink = navigation.getByRole("link", {
    name: "知识库",
    exact: true,
  });
  await expect(knowledgeLink).toHaveAttribute("href", "/knowledge");
  await expect(knowledgeLink).not.toHaveAttribute("aria-disabled", "true");

  const disabledItems = expectedItems.filter(
    (item) => !["工作台", "Task", "知识库"].includes(item),
  );
  for (const item of disabledItems) {
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
