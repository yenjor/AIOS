import { describe, expect, it } from "vitest";

import { resolvePlaywrightTarget } from "../../playwright.config";

describe("resolvePlaywrightTarget", () => {
  it("treats an explicit base URL as an external target without a managed server", () => {
    expect(
      resolvePlaywrightTarget({
        PLAYWRIGHT_BASE_URL: "https://preview.example.com/aios",
        PLAYWRIGHT_PORT: "3100",
      }),
    ).toEqual({
      baseURL: "https://preview.example.com/aios",
    });
  });

  it("keeps the local server URL and command on the same validated port", () => {
    expect(resolvePlaywrightTarget({ PLAYWRIGHT_PORT: "3100" })).toEqual({
      baseURL: "http://127.0.0.1:3100",
      webServer: {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: true,
        timeout: 120_000,
      },
    });
  });

  it.each(["", "0", "65536", "3000.5", "not-a-port"])(
    "rejects invalid local port %j",
    (port) => {
      expect(() =>
        resolvePlaywrightTarget({ PLAYWRIGHT_PORT: port }),
      ).toThrowError(/PLAYWRIGHT_PORT must be an integer from 1 to 65535/);
    },
  );
});
