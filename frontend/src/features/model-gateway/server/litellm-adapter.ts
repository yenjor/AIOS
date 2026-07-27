import type { ModelInvocationErrorClassification, ModelTokenUsage } from "../model";

export interface ModelMessage {
  role: "system" | "user";
  content: string;
}

export interface LiteLlmCompletionInput {
  messages: ModelMessage[];
  jsonSchema: unknown;
}

export interface LiteLlmCompletionOutput {
  content: string;
  resolvedModel: string;
  provider?: string;
  usage?: ModelTokenUsage;
}

export interface LiteLlmAdapter {
  readonly modelAlias: string;
  complete(input: LiteLlmCompletionInput): Promise<LiteLlmCompletionOutput>;
}

export class LiteLlmCompletionError extends Error {
  constructor(
    public readonly code: ModelInvocationErrorClassification,
    message: string,
  ) {
    super(message);
    this.name = "LiteLlmCompletionError";
  }
}

function completionEndpoint(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new LiteLlmCompletionError(
      "GATEWAY_NOT_CONFIGURED",
      "AIOS_LITELLM_BASE_URL 不是有效的 URL。",
    );
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new LiteLlmCompletionError(
      "GATEWAY_NOT_CONFIGURED",
      "LiteLLM 模型网关必须使用 HTTP 或 HTTPS。",
    );
  }
  const path = url.pathname.replace(/\/$/, "");
  url.pathname = path.endsWith("/v1/chat/completions")
    ? path
    : path.endsWith("/v1")
      ? `${path}/chat/completions`
      : `${path}/v1/chat/completions`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function integer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function usageFrom(value: unknown): ModelTokenUsage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const promptTokens = integer(record.prompt_tokens);
  const completionTokens = integer(record.completion_tokens);
  const totalTokens = integer(record.total_tokens);
  return promptTokens !== undefined &&
    completionTokens !== undefined &&
    totalTokens !== undefined
    ? { promptTokens, completionTokens, totalTokens }
    : undefined;
}

async function readBoundedBody(response: Response, maximumBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new LiteLlmCompletionError(
        "OUTPUT_INVALID",
        "LiteLLM 响应超过大小限制。",
      );
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function responseContent(value: unknown): {
  content: string;
  resolvedModel: string;
  usage?: ModelTokenUsage;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LiteLlmCompletionError(
      "OUTPUT_INVALID",
      "LiteLLM 返回了无效的补全响应封装。",
    );
  }
  const record = value as Record<string, unknown>;
  const choices = record.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message =
    first && typeof first === "object" && !Array.isArray(first)
      ? (first as Record<string, unknown>).message
      : undefined;
  const content =
    message && typeof message === "object" && !Array.isArray(message)
      ? (message as Record<string, unknown>).content
      : undefined;
  if (
    typeof content !== "string" ||
    content.length === 0 ||
    content.length > 96_000 ||
    typeof record.model !== "string" ||
    record.model.length === 0 ||
    record.model.length > 256
  ) {
    throw new LiteLlmCompletionError(
      "OUTPUT_INVALID",
      "LiteLLM 补全内容或解析后的模型无效。",
    );
  }
  const usage = usageFrom(record.usage);
  return {
    content,
    resolvedModel: record.model,
    ...(usage ? { usage } : {}),
  };
}

export function createLiteLlmAdapter({
  baseUrl = process.env.AIOS_LITELLM_BASE_URL,
  apiKey = process.env.AIOS_LITELLM_API_KEY,
  modelAlias = process.env.AIOS_LITELLM_TECHNICAL_DESIGN_MODEL_ALIAS,
  timeoutMs = 45_000,
  fetchImpl = fetch,
}: {
  baseUrl?: string;
  apiKey?: string;
  modelAlias?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
} = {}): LiteLlmAdapter {
  const configuredAlias = modelAlias?.trim() || "unconfigured";
  return {
    modelAlias: configuredAlias,
    async complete(input) {
      if (
        !baseUrl?.trim() ||
        configuredAlias === "unconfigured" ||
        !/^[a-zA-Z0-9._:/-]{1,160}$/.test(configuredAlias)
      ) {
        throw new LiteLlmCompletionError(
          "GATEWAY_NOT_CONFIGURED",
          "尚未配置 LiteLLM 模型网关地址和技术方案模型别名。",
        );
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(completionEndpoint(baseUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(apiKey?.trim()
              ? { Authorization: `Bearer ${apiKey.trim()}` }
              : {}),
            "X-AIOS-模型-Policy": "reasoning-structured-output",
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            model: configuredAlias,
            messages: input.messages,
            temperature: 0.1,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "aios_technical_design_v1",
                strict: true,
                schema: input.jsonSchema,
              },
            },
          }),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new LiteLlmCompletionError(
            "GATEWAY_TIMEOUT",
            "LiteLLM 请求超时；模型提供方的补全状态未知。",
          );
        }
        if (error instanceof LiteLlmCompletionError) throw error;
        throw new LiteLlmCompletionError(
          "GATEWAY_UNAVAILABLE",
          "无法连接 LiteLLM 模型网关。",
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const classification =
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR";
        throw new LiteLlmCompletionError(
          classification,
          `LiteLLM 拒绝了补全请求，HTTP 状态码为 ${response.status}。`,
        );
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > 128_000) {
        throw new LiteLlmCompletionError(
          "OUTPUT_INVALID",
          "LiteLLM 响应超过大小限制。",
        );
      }
      const raw = await readBoundedBody(response, 128_000);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new LiteLlmCompletionError(
          "OUTPUT_INVALID",
          "LiteLLM 返回了非 JSON 响应。",
        );
      }
      const completion = responseContent(parsed);
      const provider = response.headers.get("x-aios-model-provider")?.trim();
      return {
        ...completion,
        ...(provider && provider.length <= 128 ? { provider } : {}),
      };
    },
  };
}
