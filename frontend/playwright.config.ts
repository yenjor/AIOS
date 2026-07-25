import { defineConfig, devices } from "@playwright/test";

interface PlaywrightTargetEnvironment {
  CI?: string;
  PLAYWRIGHT_BASE_URL?: string;
  PLAYWRIGHT_PORT?: string;
}

interface LocalWebServer {
  command: string;
  url: string;
  reuseExistingServer: boolean;
  timeout: number;
}

interface PlaywrightTarget {
  baseURL: string;
  webServer?: LocalWebServer;
}

export function resolvePlaywrightWorkers(
  environment: Pick<PlaywrightTargetEnvironment, "CI">,
): number {
  return environment.CI ? 1 : 2;
}

export function resolvePlaywrightTarget(
  environment: PlaywrightTargetEnvironment,
): PlaywrightTarget {
  if (environment.PLAYWRIGHT_BASE_URL !== undefined) {
    return {
      baseURL: environment.PLAYWRIGHT_BASE_URL,
    };
  }

  const rawPort = environment.PLAYWRIGHT_PORT ?? "3000";
  const port = Number(rawPort);

  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw new Error("PLAYWRIGHT_PORT must be an integer from 1 to 65535");
  }

  const baseURL = `http://127.0.0.1:${port}`;

  return {
    baseURL,
    webServer: {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer: !environment.CI,
      timeout: 120_000,
    },
  };
}

const target = resolvePlaywrightTarget({
  CI: process.env.CI,
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
  PLAYWRIGHT_PORT: process.env.PLAYWRIGHT_PORT,
});

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: resolvePlaywrightWorkers({ CI: process.env.CI }),
  reporter: [["list"]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: target.baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(target.webServer ? { webServer: target.webServer } : {}),
});
