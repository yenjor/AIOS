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
  const expectedOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    origin !== expectedOrigin ||
    (fetchSite !== null && fetchSite !== "same-origin") ||
    request.headers.get("x-aios-runtime-contract") !== "local-pilot-v1"
  ) {
    return NextResponse.json(
      {
        error: {
          code: "RUNTIME_ORIGIN_DENIED",
          message:
            "The local pilot Tool Broker only accepts same-origin runtime requests.",
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
          message: "Content-Type must be application/json.",
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
            message: "ToolActionRequest exceeds the 32 KiB limit.",
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
          message: "Request body must be valid JSON.",
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
          message: "Tool Broker could not complete the invocation.",
        },
      },
      { status: 500 },
    );
  }
}
