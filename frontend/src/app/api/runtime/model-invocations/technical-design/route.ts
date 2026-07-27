import { NextResponse } from "next/server";

import type { InvokeTechnicalDesignModelInput } from "@/features/model-gateway/model";
import {
  createModelGateway,
  ModelGatewayError,
} from "@/features/model-gateway/server/model-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gateway = createModelGateway();
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
            "The local pilot Model Gateway only accepts same-origin runtime requests.",
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

  let body: InvokeTechnicalDesignModelInput;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "REQUEST_TOO_LARGE",
            message: "ModelInvocationRequest exceeds the 32 KiB limit.",
          },
        },
        { status: 413 },
      );
    }
    body = JSON.parse(rawBody) as InvokeTechnicalDesignModelInput;
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
    const invocation = await gateway.invokeTechnicalDesign(body);
    const status =
      invocation.status === "SUCCEEDED"
        ? 200
        : invocation.status === "UNKNOWN"
          ? 504
          : 503;
    return NextResponse.json(
      { data: invocation, meta: { runtime: "model-gateway-v1" } },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    if (error instanceof ModelGatewayError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "MODEL_GATEWAY_FAILURE",
          message: "Model Gateway could not complete the invocation.",
        },
      },
      { status: 500 },
    );
  }
}
