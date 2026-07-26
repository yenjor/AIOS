"use client";

import {
  AlertCircle,
  FileText,
  LoaderCircle,
  Upload,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type {
  KnowledgeClassification,
  KnowledgeSourceType,
} from "./model";

const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 py-2 text-sm text-[var(--aios-text)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]";
const labelClass = "mb-2 block text-sm font-semibold";
const helpClass = "mt-2 text-xs leading-5 text-[var(--aios-muted)]";
const MAX_CONTENT_BYTES = 50_000;

export interface KnowledgeContentValues {
  fileName: string;
  mediaType: "text/plain" | "text/markdown";
  content: string;
}

export interface KnowledgeRegistrationValues
  extends KnowledgeContentValues {
  code: string;
  title: string;
  description: string;
  sourceType: KnowledgeSourceType;
  sourceLocation: string;
  sourceAuthority: string;
  ownerId: string;
  classification: KnowledgeClassification;
}

interface FileState {
  status: "idle" | "reading" | "ready" | "error";
  message?: string;
}

function mediaTypeFor(fileName: string): KnowledgeContentValues["mediaType"] {
  return fileName.toLowerCase().endsWith(".md")
    ? "text/markdown"
    : "text/plain";
}

async function readTextFile(
  event: ChangeEvent<HTMLInputElement>,
): Promise<KnowledgeContentValues | undefined> {
  const file = event.target.files?.[0];
  if (!file) {
    return undefined;
  }
  if (
    !file.name.toLowerCase().endsWith(".md") &&
    !file.name.toLowerCase().endsWith(".txt")
  ) {
    throw new Error("只支持 UTF-8 Markdown（.md）或纯文本（.txt）文件。");
  }
  if (file.size > MAX_CONTENT_BYTES) {
    throw new Error("Mock 导入文件不能超过 50 KB。");
  }
  const content = await file.text();
  if (!content.trim()) {
    throw new Error("导入文件不能为空。");
  }
  return {
    fileName: file.name,
    mediaType: mediaTypeFor(file.name),
    content,
  };
}

function ContentFields({
  values,
  onChange,
}: {
  values: KnowledgeContentValues;
  onChange: (values: KnowledgeContentValues) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileState, setFileState] = useState<FileState>({ status: "idle" });

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setFileState({ status: "reading" });
    try {
      const fileValues = await readTextFile(event);
      if (fileValues) {
        onChange(fileValues);
        setFileState({
          status: "ready",
          message: `${fileValues.fileName} 已读取到浏览器内存。`,
        });
      } else {
        setFileState({ status: "idle" });
      }
    } catch (error) {
      event.target.value = "";
      setFileState({
        status: "error",
        message:
          error instanceof Error ? error.message : "无法读取导入文件。",
      });
    }
  }

  return (
    <>
      <div className="rounded-lg border border-dashed border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Upload
              className="mt-0.5 shrink-0 text-[var(--aios-primary)]"
              size={20}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold">导入 Markdown / Text</p>
              <p className={helpClass}>
                文件仅用于填充正文；MVP 使用 Mock Content Store，不上传到 MinIO。
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            选择文件
          </Button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            onChange={(event) => void handleFile(event)}
          />
        </div>
        {fileState.status !== "idle" ? (
          <p
            className={`mt-3 text-xs ${
              fileState.status === "error"
                ? "text-[var(--aios-error-foreground)]"
                : "text-[var(--aios-muted)]"
            }`}
            role={fileState.status === "error" ? "alert" : "status"}
          >
            {fileState.status === "reading"
              ? "正在读取文件…"
              : fileState.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="knowledge-file-name">
          文件名
        </label>
        <input
          required
          id="knowledge-file-name"
          className={inputClass}
          maxLength={180}
          value={values.fileName}
          onChange={(event) =>
            onChange({
              ...values,
              fileName: event.target.value,
              mediaType: mediaTypeFor(event.target.value),
            })
          }
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="knowledge-content">
          知识正文
        </label>
        <textarea
          required
          id="knowledge-content"
          className={`${inputClass} min-h-72 resize-y font-mono leading-6`}
          value={values.content}
          onChange={(event) =>
            onChange({ ...values, content: event.target.value })
          }
        />
        <p className={helpClass}>
          正文上限 50 KB。提交时在浏览器内计算 SHA-256；不会把 File
          对象或 Secret 写入本地仓储。
        </p>
      </div>
    </>
  );
}

export function KnowledgeRegistrationForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error?: string;
  onSubmit: (values: KnowledgeRegistrationValues) => Promise<void>;
}) {
  const [values, setValues] = useState<KnowledgeRegistrationValues>({
    code: "",
    title: "",
    description: "",
    sourceType: "DOCUMENT",
    sourceLocation: "",
    sourceAuthority: "",
    ownerId: "user-lead",
    classification: "INTERNAL",
    fileName: "knowledge.md",
    mediaType: "text/markdown",
    content: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            知识条目命令
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            新增知识
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            注册来源、所有者、敏感等级和适用范围，并创建首个不可变版本。
            完成处理不代表自动生效，发布仍需人工显式确认。
          </p>
        </div>
        <Link
          href="/knowledge"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
        >
          返回知识库
        </Link>
      </header>

      <Card className="mt-6 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="knowledge-code">
              知识库编码
            </label>
            <input
              required
              id="knowledge-code"
              className={inputClass}
              maxLength={80}
              placeholder="engineering-release-guide"
              value={values.code}
              onChange={(event) =>
                setValues({ ...values, code: event.target.value })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="knowledge-title">
              标题
            </label>
            <input
              required
              id="knowledge-title"
              className={inputClass}
              maxLength={160}
              value={values.title}
              onChange={(event) =>
                setValues({ ...values, title: event.target.value })
              }
            />
          </div>
          <div className="lg:col-span-2">
            <label className={labelClass} htmlFor="knowledge-description">
              描述
            </label>
            <textarea
              required
              id="knowledge-description"
              className={`${inputClass} min-h-24 resize-y`}
              maxLength={600}
              value={values.description}
              onChange={(event) =>
                setValues({ ...values, description: event.target.value })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="knowledge-source-type">
              来源类型
            </label>
            <select
              id="knowledge-source-type"
              className={inputClass}
              value={values.sourceType}
              onChange={(event) =>
                setValues({
                  ...values,
                  sourceType: event.target.value as KnowledgeSourceType,
                })
              }
            >
              {["DOCUMENT", "CODE", "SOP", "HISTORY", "EXPERIENCE"].map(
                (sourceType) => (
                  <option key={sourceType}>{sourceType}</option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="knowledge-classification">
              敏感等级
            </label>
            <select
              id="knowledge-classification"
              className={inputClass}
              value={values.classification}
              onChange={(event) =>
                setValues({
                  ...values,
                  classification: event.target
                    .value as KnowledgeClassification,
                })
              }
            >
              {["PUBLIC", "INTERNAL", "CONFIDENTIAL"].map(
                (classification) => (
                  <option key={classification}>{classification}</option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="knowledge-source-location">
              来源位置
            </label>
            <input
              required
              id="knowledge-source-location"
              className={inputClass}
              maxLength={300}
              placeholder="docs/engineering/release.md"
              value={values.sourceLocation}
              onChange={(event) =>
                setValues({ ...values, sourceLocation: event.target.value })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="knowledge-source-authority">
              来源权威性
            </label>
            <input
              required
              id="knowledge-source-authority"
              className={inputClass}
              maxLength={300}
              placeholder="经研发负责人审批的正式规范"
              value={values.sourceAuthority}
              onChange={(event) =>
                setValues({ ...values, sourceAuthority: event.target.value })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="knowledge-owner">
              所有者
            </label>
            <select
              id="knowledge-owner"
              className={inputClass}
              value={values.ownerId}
              onChange={(event) =>
                setValues({ ...values, ownerId: event.target.value })
              }
            >
              <option value="user-lead">陈明（研发负责人）</option>
              <option value="user-admin">吴桐（Workspace Admin）</option>
            </select>
          </div>
          <div>
            <span className={labelClass}>适用范围</span>
            <div className="min-h-11 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] px-3 py-2 text-sm">
              当前 Workspace · software_engineering_tasks
            </div>
            <p className={helpClass}>
              MVP 固定为当前 Workspace，禁止跨租户或静默扩大范围。
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-5 space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileText
            size={20}
            className="text-[var(--aios-primary)]"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold">首个知识版本</h2>
        </div>
        <ContentFields
          values={values}
          onChange={(contentValues) =>
            setValues({ ...values, ...contentValues })
          }
        />
      </Card>

      {error ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] bg-[var(--aios-surface)] p-4"
        >
          <AlertCircle
            className="mt-0.5 shrink-0 text-[var(--aios-error-foreground)]"
            size={20}
            aria-hidden="true"
          />
          <p className="text-sm leading-6">{error}</p>
        </div>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              size={18}
              aria-hidden="true"
            />
          ) : null}
          {busy ? "正在注册并处理…" : "注册知识"}
        </Button>
      </div>
    </form>
  );
}

export function KnowledgeVersionForm({
  busy,
  error,
  knowledgeId,
  onSubmit,
}: {
  busy: boolean;
  error?: string;
  knowledgeId: string;
  onSubmit: (values: KnowledgeContentValues) => Promise<void>;
}) {
  const [values, setValues] = useState<KnowledgeContentValues>({
    fileName: "knowledge.md",
    mediaType: "text/markdown",
    content: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <header>
        <p className="text-sm font-semibold text-[var(--aios-primary)]">
          知识版本命令
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          创建新版本
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
          有效版本不会被原地修改。新内容将创建 Draft，完成确定性 Mock
          处理和权限负向验证后等待发布。
        </p>
      </header>

      <Card className="mt-6 space-y-5 p-5 sm:p-6">
        <ContentFields values={values} onChange={setValues} />
      </Card>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] bg-[var(--aios-surface)] p-4 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Link
          href={`/knowledge/${knowledgeId}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold hover:bg-[var(--aios-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]"
        >
          取消
        </Link>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              size={18}
              aria-hidden="true"
            />
          ) : null}
          {busy ? "正在创建版本…" : "创建 Draft"}
        </Button>
      </div>
    </form>
  );
}
