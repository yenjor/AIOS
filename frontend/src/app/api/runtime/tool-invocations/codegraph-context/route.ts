import { NextResponse } from "next/server";

import type { InvokeCodeGraphContextInput } from "@/features/tool/model";
import {
  createToolBroker,
  ToolBrokerError,
} from "@/features/tool/server/tool-broker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const broker = createToolBroker();
const MAX_REQUEST_BYTES = 32_768;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const expectedOrigins = new Set([requestUrl.origin]);
  const requestHost = request.headers.get("host");
  if (requestHost) {
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      .trim();
    expectedOrigins.add(
      `${forwardedProtocol || requestUrl.protocol.replace(":", "")}://${requestHost}`,
    );
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    !origin ||
    !expectedOrigins.has(origin) ||
    (fetchSite !== null && fetchSite !== "same-origin") ||
    request.headers.get("x-aios-runtime-contract") !== "local-pilot-v1"
  ) {
    return NextResponse.json(
      {
        error: {
          code: "RUNTIME_ORIGIN_DENIED",
          message:
            "本地试点工具代理仅接受同源运行时请求。",
        },
      },
      { status: 403 },
    );
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return NextResponse.json(
      {
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "内容类型必须为 application/json。",
        },
      },
      { status: 415 },
    );
  }

  let body: InvokeCodeGraphContextInput;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "REQUEST_TOO_LARGE",
            message: "工具动作请求超过 32 KiB 限制。",
          },
        },
        { status: 413 },
      );
    }
    body = JSON.parse(rawBody) as InvokeCodeGraphContextInput;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "请求正文必须是有效的 JSON。",
        },
      },
      { status: 400 },
    );
  }

  try {
    const invocation = await broker.invokeCodeGraphContext(body);
    return NextResponse.json(
      { data: invocation, meta: { runtime: "tool-broker-v1" } },
      {
        status: invocation.status === "SUCCEEDED" ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    if (error instanceof ToolBrokerError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "TOOL_BROKER_FAILURE",
          message: "工具代理未能完成调用。",
        },
      },
      { status: 500 },
    );
  }
}
