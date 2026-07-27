import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type CodeGraphMcpErrorCode =
  | "MCP_UNAVAILABLE"
  | "TRANSPORT_TIMEOUT"
  | "INVALID_RESULT";

export class CodeGraphMcpError extends Error {
  constructor(
    public readonly code: CodeGraphMcpErrorCode,
    message: string,
    public readonly sessionInitialized = false,
  ) {
    super(message);
    this.name = "CodeGraphMcpError";
  }
}

export interface CodeGraphContextResult {
  text: string;
  sessionInitialized: true;
  serverIdentity: "codegraph";
  serverVersion: string;
}

export interface CodeGraphMcpAdapter {
  context(query: string): Promise<CodeGraphContextResult>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
}

interface McpToolResult {
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
}

const MAX_STDOUT_BYTES = 1_500_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function projectRoot(): string {
  const configured = process.env.AIOS_CODEGRAPH_PROJECT_ROOT;
  return configured ? resolve(configured) : resolve(process.cwd(), "..");
}

function spawnCodeGraph(root: string): ChildProcessWithoutNullStreams {
  if (process.platform === "win32") {
    const commandInterpreter = process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe";
    const escapedRoot = root.replaceAll('"', '""');
    return spawn(
      commandInterpreter,
      [
        "/d",
        "/s",
        "/c",
        `codegraph serve --mcp --no-watch -p "${escapedRoot}"`,
      ],
      {
        cwd: root,
        env: { ...process.env, NO_COLOR: "1" },
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  }

  return spawn(
    "codegraph",
    ["serve", "--mcp", "--no-watch", "-p", root],
    {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function toolText(result: unknown): string {
  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result)
  ) {
    throw new CodeGraphMcpError(
      "INVALID_RESULT",
      "MCP 工具返回了无效的结果封装。",
      true,
    );
  }
  const candidate = result as McpToolResult;
  const text = candidate.content
    ?.filter(
      (item): item is { type: string; text: string } =>
        item.type === "text" && typeof item.text === "string",
    )
    .map(({ text: value }) => value)
    .join("\n")
    .trim();
  if (candidate.isError || !text) {
    throw new CodeGraphMcpError(
      "INVALID_RESULT",
      text || "MCP 工具返回了空结果。",
      true,
    );
  }
  return text;
}

export function createCodeGraphMcpAdapter({
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  timeoutMs?: number;
} = {}): CodeGraphMcpAdapter {
  return {
    context(query) {
      const root = projectRoot();
      if (!existsSync(resolve(root, ".codegraph"))) {
        return Promise.reject(
          new CodeGraphMcpError(
            "MCP_UNAVAILABLE",
            "当前 AIOS 工作空间尚未初始化 CodeGraph 索引。",
          ),
        );
      }

      return new Promise<CodeGraphContextResult>((resolveResult, reject) => {
        const child = spawnCodeGraph(root);
        let stdoutBuffer = "";
        let stdoutBytes = 0;
        let stderr = "";
        let settled = false;
        let initialized = false;
        let serverVersion = "unknown";
        const timer = setTimeout(() => {
          finish({
            ok: false,
            error: new CodeGraphMcpError(
              "TRANSPORT_TIMEOUT",
              "CodeGraph MCP 调用超过 15 秒时限。",
              initialized,
            ),
          });
        }, timeoutMs);

        const finish = (
          result:
            | { ok: true; value: CodeGraphContextResult }
            | { ok: false; error: CodeGraphMcpError },
        ) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.kill();
          if (result.ok) resolveResult(result.value);
          else reject(result.error);
        };

        const send = (message: unknown) => {
          child.stdin.write(`${JSON.stringify(message)}\n`);
        };

        const handleResponse = (response: JsonRpcResponse) => {
          if (response.id === 1) {
            if (response.error || !response.result) {
              finish({
                ok: false,
                error: new CodeGraphMcpError(
                  "MCP_UNAVAILABLE",
                  response.error?.message ?? "MCP 初始化失败。",
                ),
              });
              return;
            }
            initialized = true;
            if (
              typeof response.result === "object" &&
              response.result !== null &&
              !Array.isArray(response.result)
            ) {
              const info = (
                response.result as {
                  serverInfo?: { version?: unknown };
                }
              ).serverInfo;
              if (typeof info?.version === "string") {
                serverVersion = info.version;
              }
            }
            send({
              jsonrpc: "2.0",
              method: "notifications/initialized",
              params: {},
            });
            send({
              jsonrpc: "2.0",
              id: 2,
              method: "tools/call",
              params: {
                name: "codegraph_context",
                arguments: {
                  task: query,
                  maxNodes: 24,
                  includeCode: true,
                  projectPath: root,
                },
              },
            });
            return;
          }

          if (response.id === 2) {
            if (response.error) {
              finish({
                ok: false,
                error: new CodeGraphMcpError(
                  "INVALID_RESULT",
                  response.error.message ?? "CodeGraph 上下文检索失败。",
                  initialized,
                ),
              });
              return;
            }
            try {
              finish({
                ok: true,
                value: {
                  text: toolText(response.result),
                  sessionInitialized: true,
                  serverIdentity: "codegraph",
                  serverVersion,
                },
              });
            } catch (error) {
              finish({
                ok: false,
                error:
                  error instanceof CodeGraphMcpError
                    ? error
                    : new CodeGraphMcpError(
                        "INVALID_RESULT",
                        "无法规范化 MCP 工具结果。",
                        initialized,
                      ),
              });
            }
          }
        };

        child.stdout.on("data", (chunk: Buffer) => {
          stdoutBytes += chunk.byteLength;
          if (stdoutBytes > MAX_STDOUT_BYTES) {
            finish({
              ok: false,
              error: new CodeGraphMcpError(
                "INVALID_RESULT",
                "MCP 输出超过配置的大小限制。",
                initialized,
              ),
            });
            return;
          }
          stdoutBuffer += chunk.toString("utf8");
          for (;;) {
            const newlineIndex = stdoutBuffer.indexOf("\n");
            if (newlineIndex < 0) break;
            const line = stdoutBuffer.slice(0, newlineIndex).trim();
            stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
            if (!line) continue;
            try {
              handleResponse(JSON.parse(line) as JsonRpcResponse);
            } catch {
              // 忽略非协议诊断行；标准错误输出会单独采集。
            }
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          if (stderr.length < 4_000) stderr += chunk.toString("utf8");
        });

        child.on("error", (error) => {
          finish({
            ok: false,
            error: new CodeGraphMcpError(
              "MCP_UNAVAILABLE",
              `无法启动 CodeGraph MCP 服务：${error.message}`,
              initialized,
            ),
          });
        });

        child.on("exit", (code) => {
          if (!settled) {
            finish({
              ok: false,
              error: new CodeGraphMcpError(
                "MCP_UNAVAILABLE",
                `CodeGraph MCP 服务在请求完成前退出（退出码 ${code ?? "未知"}）。${stderr.trim()}`.slice(
                  0,
                  800,
                ),
                initialized,
              ),
            });
          }
        });

        send({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "aios-tool-broker", version: "0.1.0" },
          },
        });
      });
    },
  };
}
