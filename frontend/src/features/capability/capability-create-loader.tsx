"use client";

import { AlertCircle, ArrowLeft, Boxes, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/session/session-provider";
import { users } from "@/mock/fixtures";

import {
  CapabilityRepositoryError,
  createCapability,
  getCapabilityPermission,
} from "./mock/capability-repository";
import type {
  ArtifactContract,
  CapabilityPermissionDecision,
  CapabilityTaskType,
  CreateCapabilityInput,
} from "./model";

const taskOptions: Array<{
  value: CapabilityTaskType;
  label: string;
  artifact: ArtifactContract["artifactType"];
}> = [
  { value: "GENERATE_TECHNICAL_DESIGN", label: "生成技术方案", artifact: "TECHNICAL_DESIGN" },
  { value: "ANALYZE_REQUIREMENT", label: "分析需求", artifact: "REQUIREMENT_ANALYSIS" },
  { value: "CODE_REVIEW", label: "代码审查", artifact: "CODE_REVIEW_REPORT" },
  { value: "AUTOMATED_TEST", label: "自动测试", artifact: "TEST_REPORT" },
];
const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]";

export function CapabilityCreateLoader() {
  const { hydrated, organization, user, workspace } = useSession();
  const router = useRouter();
  const [permission, setPermission] = useState<CapabilityPermissionDecision>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const complete = Boolean(hydrated && organization && user && workspace);

  useEffect(() => {
    if (!organization || !user || !workspace) return;
    let active = true;
    void getCapabilityPermission(
      { organizationId: organization.id, workspaceId: workspace.id },
      { userId: user.id },
    ).then((decision) => {
      if (active) setPermission(decision);
    });
    return () => {
      active = false;
    };
  }, [organization, user, workspace]);

  if (!complete || !organization || !user || !workspace || !permission) {
    return complete ? (
      <Card role="status" className="mx-auto flex max-w-xl items-center gap-3 p-6">
        <LoaderCircle className="animate-spin text-[var(--aios-primary)] motion-reduce:animate-none" size={20} aria-hidden="true" />
        正在加载 Capability Builder 权限…
      </Card>
    ) : null;
  }

  if (!permission.canManage) {
    return (
      <Card role="alert" className="mx-auto max-w-xl p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-[var(--aios-warning-foreground)]" size={21} aria-hidden="true" />
          <div>
            <h1 className="font-semibold">当前身份不能创建能力</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">{permission.reason}</p>
            <Link href="/capabilities" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--aios-primary)] underline-offset-4 hover:underline">
              <ArrowLeft size={16} aria-hidden="true" />返回能力中心
            </Link>
          </div>
        </div>
      </Card>
    );
  }
  const activeOrganization = organization;
  const activeWorkspace = workspace;
  const activeUser = user;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const taskType = String(data.get("taskType")) as CapabilityTaskType;
    const task = taskOptions.find(({ value }) => value === taskType)!;
    const input: CreateCapabilityInput = {
      code: String(data.get("code")).trim().toUpperCase(),
      name: String(data.get("name")).trim(),
      purpose: String(data.get("purpose")).trim(),
      ownerId: String(data.get("ownerId")),
      taskType,
      promptId: String(data.get("promptId")).trim(),
      modelProfile: String(data.get("modelProfile")).trim(),
      workflowId: String(data.get("workflowId")).trim(),
      artifactType: task.artifact,
      includeKnowledge: data.get("includeKnowledge") === "on",
      ...(String(data.get("toolAction")).trim()
        ? { toolAction: String(data.get("toolAction")).trim() }
        : {}),
    };
    try {
      const capability = await createCapability(
        {
          organizationId: activeOrganization.id,
          workspaceId: activeWorkspace.id,
        },
        { userId: activeUser.id },
        input,
      );
      router.push(`/capabilities/${capability.id}`);
    } catch (caught) {
      setError(
        caught instanceof CapabilityRepositoryError
          ? caught.message
          : "能力创建失败，未写入不完整配置。",
      );
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/capabilities" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--aios-primary)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]">
        <ArrowLeft size={16} aria-hidden="true" />返回能力中心
      </Link>
      <header className="mt-3">
        <p className="text-sm font-semibold text-[var(--aios-primary)]">Capability Builder</p>
        <h1 className="mt-1 text-3xl font-semibold">创建能力 Draft</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
          一个 CapabilityVersion 固定 Skill、Prompt、Model、知识需求、Tool Action、
          Workflow、Permission、Artifact、Evaluation 与 FailurePolicy。创建后必须评测并审查，不能直接 Published。
        </p>
      </header>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error ? (
          <Card role="alert" className="flex items-start gap-3 border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] p-4">
            <AlertCircle className="mt-0.5 text-[var(--aios-error-foreground)]" size={19} aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </Card>
        ) : null}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Boxes size={19} aria-hidden="true" />业务身份与 Skill</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold">Capability Code
              <input required name="code" pattern="[A-Za-z][A-Za-z0-9_]{2,63}" placeholder="TECHNICAL_RESEARCH" className={inputClass} />
            </label>
            <label className="text-sm font-semibold">能力名称
              <input required name="name" placeholder="技术调研" className={inputClass} />
            </label>
            <label className="text-sm font-semibold md:col-span-2">Purpose
              <textarea required name="purpose" rows={3} placeholder="说明能力解决的问题、适用边界和预期成果。" className={inputClass} />
            </label>
            <label className="text-sm font-semibold">TaskType
              <select name="taskType" className={inputClass}>
                {taskOptions.map((option) => <option value={option.value} key={option.value}>{option.label} · {option.artifact}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Owner
              <select name="ownerId" defaultValue="user-lead" className={inputClass}>
                {users.filter(({ id }) => id !== "user-auditor").map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.role}</option>)}
              </select>
            </label>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">固定执行组成</h2>
          <p className="mt-2 text-sm text-[var(--aios-muted)]">这里只保存版本引用和治理策略，不保存 Prompt 正文、知识正文、Credential 或运行状态。</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold">PromptTemplateRef
              <input required name="promptId" defaultValue="prompt-capability-custom" className={inputClass} />
            </label>
            <label className="text-sm font-semibold">ModelPolicy Profile
              <input required name="modelProfile" defaultValue="reasoning-structured-output" className={inputClass} />
            </label>
            <label className="text-sm font-semibold">WorkflowVersionRef
              <input required name="workflowId" defaultValue="workflow-capability-standard" className={inputClass} />
            </label>
            <label className="text-sm font-semibold">Tool Action（可选）
              <input name="toolAction" placeholder="codegraph.context" className={inputClass} />
            </label>
            <label className="md:col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4 text-sm">
              <input type="checkbox" name="includeKnowledge" defaultChecked className="mt-1 accent-[var(--aios-primary)]" />
              <span><span className="block font-semibold">需要当前 Workspace 的有效知识库版本</span><span className="mt-1 block leading-6 text-[var(--aios-muted)]">固定 Requirement；Task Resolution 与 Runtime 仍会执行 Scope、Classification、Purpose、Permission 与 Citation 校验。</span></span>
            </label>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">发布门禁</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--aios-muted)] sm:grid-cols-2">
            <li>• 3 次确定性代表性样本</li><li>• Quality Score ≥ 0.85</li>
            <li>• Prompt Injection 与越权负向测试</li><li>• ArtifactContract 映射检查</li>
            <li>• Permission Default Deny</li><li>• 人工 Reviewer 显式发布</li>
          </ul>
        </Card>
        <div className="flex flex-wrap justify-end gap-3">
          <Link href="/capabilities" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--aios-control-border)] px-4 text-sm font-semibold">取消</Link>
          <Button disabled={saving} type="submit">{saving ? "正在创建…" : "创建 Draft"}</Button>
        </div>
      </form>
    </div>
  );
}
