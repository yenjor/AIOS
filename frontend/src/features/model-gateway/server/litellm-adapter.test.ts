import { describe, expect, it, vi } from "vitest";

import { createLiteLlmAdapter, LiteLlmCompletionError } from "./litellm-adapter";

const completionEnvelope = {
  id: "chatcmpl-test",
  model: "provider/resolved-model",
  choices: [{ message: { role: "assistant", content: '{"sections":[]}' } }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
};

describe("LiteLLM adapter", () => {
  it("uses the server-side alias and bearer key without returning credentials", async () => {
    const fetchImpl = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer secret-key",
        "X-AIOS-Model-Policy": "reasoning-structured-output",
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "aios-technical-design",
        response_format: { type: "json_schema" },
      });
      return new Response(JSON.stringify(completionEnvelope), {
        status: 200,
        headers: { "x-aios-model-provider": "test-provider" },
      });
    }) as unknown as typeof fetch;
    const adapter = createLiteLlmAdapter({
      baseUrl: "http://127.0.0.1:4000",
      apiKey: "secret-key",
      modelAlias: "aios-technical-design",
      fetchImpl,
    });

    const result = await adapter.complete({
      messages: [{ role: "user", content: "bounded context" }],
      jsonSchema: { type: "object" },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/v1/chat/completions",
      expect.any(Object),
    );
    expect(result).toEqual({
      content: '{"sections":[]}',
      resolvedModel: "provider/resolved-model",
      provider: "test-provider",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("refuses to fake a completion when gateway deployment is not configured", async () => {
    const adapter = createLiteLlmAdapter({ baseUrl: "", modelAlias: "" });
    await expect(
      adapter.complete({ messages: [], jsonSchema: {} }),
    ).rejects.toMatchObject({
      code: "GATEWAY_NOT_CONFIGURED",
    } satisfies Partial<LiteLlmCompletionError>);
  });

  it("classifies an explicit rate limit without exposing the provider body", async () => {
    const adapter = createLiteLlmAdapter({
      baseUrl: "http://127.0.0.1:4000/v1",
      modelAlias: "aios-technical-design",
      fetchImpl: vi.fn(async () =>
        new Response('{"error":"provider details"}', { status: 429 }),
      ) as unknown as typeof fetch,
    });
    await expect(
      adapter.complete({ messages: [], jsonSchema: {} }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "LiteLLM rejected the completion with HTTP 429.",
    });
  });

  it("stops reading a chunked response after the bounded size is exceeded", async () => {
    const adapter = createLiteLlmAdapter({
      baseUrl: "http://127.0.0.1:4000",
      modelAlias: "aios-technical-design",
      fetchImpl: vi.fn(async () =>
        new Response("x".repeat(128_001), {
          status: 200,
          headers: { "transfer-encoding": "chunked" },
        }),
      ) as unknown as typeof fetch,
    });
    await expect(
      adapter.complete({ messages: [], jsonSchema: {} }),
    ).rejects.toMatchObject({ code: "OUTPUT_INVALID" });
  });
});
