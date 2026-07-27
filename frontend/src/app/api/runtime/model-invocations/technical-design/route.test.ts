import { describe, expect, it } from "vitest";

import { POST } from "./route";

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request(
    "http://127.0.0.1:3000/api/runtime/model-invocations/technical-design",
    {
      method: "POST",
      headers: {
        Origin: "http://127.0.0.1:3000",
        Host: "127.0.0.1:3000",
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/json",
        "X-AIOS-Runtime-Contract": "local-pilot-v1",
        ...headers,
      },
      body,
    },
  );
}

describe("模型调用 route boundary", () => {
  it("rejects cross-origin requests before parsing an invocation", async () => {
    const response = await POST(
      request("{}", { Origin: "https://untrusted.example" }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RUNTIME_ORIGIN_DENIED" },
    });
  });

  it("rejects malformed and oversized JSON bodies", async () => {
    const malformed = await POST(request("{"));
    const oversized = await POST(
      request(JSON.stringify({ context: "a".repeat(33_000) })),
    );
    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
  });

  it("accepts a browser origin matching Host when the internal URL differs", async () => {
    const response = await POST(
      new Request(
        "http://localhost:3000/api/runtime/model-invocations/technical-design",
        {
          method: "POST",
          headers: {
            Origin: "http://127.0.0.1:3000",
            Host: "127.0.0.1:3000",
            "Sec-Fetch-Site": "same-origin",
            "Content-Type": "application/json",
            "X-AIOS-Runtime-Contract": "local-pilot-v1",
          },
          body: "{",
        },
      ),
    );
    expect(response.status).toBe(400);
  });
});
