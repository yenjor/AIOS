import {
  Bot,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DeepReadonly } from "@/types/domain";

import type {
  ApprovalPoint,
  ExecutionPlan as ExecutionPlanModel,
  ExpectedArtifact,
} from "./model";

interface ExecutionPlanProps {
  plan?: DeepReadonly<ExecutionPlanModel>;
  expectedArtifact: DeepReadonly<ExpectedArtifact>;
  completionCriteria: readonly string[];
  approvalPoints: readonly DeepReadonly<ApprovalPoint>[];
}

function Definition({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string | number;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--aios-canvas)] p-3">
      <dt className="text-xs font-medium text-[var(--aios-muted)]">{label}</dt>
      <dd
        className={
          breakAll
            ? "mt-1 break-all font-mono text-xs leading-5 text-[var(--aios-text)]"
            : "mt-1 text-sm font-semibold text-[var(--aios-text)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function ExecutionPlan({
  plan,
  expectedArtifact,
  completionCriteria,
  approvalPoints,
}: ExecutionPlanProps) {
  if (!plan) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <CircleAlert
            size={20}
            className="mt-0.5 shrink-0 text-[var(--aios-muted)]"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">计划尚未生成</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
              当前 Task 还没有持久化的 ExecutionPlan，不展示推测性步骤。
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck
            size={19}
            className="text-[var(--aios-primary)]"
            aria-hidden="true"
          />
          <h3 className="font-semibold">计划身份与范围摘要</h3>
        </div>
        <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Definition
            label="PlanVersion"
            value={plan.versionRef.versionId}
            breakAll
          />
          <Definition
            label="PlanDigest"
            value={plan.versionRef.digest}
            breakAll
          />
          <Definition
            label="ScopeDigest"
            value={plan.scopeDigest}
            breakAll
          />
          <Definition
            label="Version Number"
            value={`v${plan.versionRef.versionNumber}`}
          />
        </dl>
        <div className="mt-4 rounded-lg border border-[var(--aios-control-border)] p-4">
          <h4 className="text-sm font-semibold">Goal Interpretation</h4>
          <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
            {plan.goalInterpretation}
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold">Assumptions</h4>
            {plan.assumptions.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm text-[var(--aios-muted)]">
                {plan.assumptions.map((assumption) => (
                  <li key={assumption} className="flex gap-2">
                    <CheckCircle2
                      className="mt-0.5 shrink-0 text-[var(--aios-success-foreground)]"
                      size={16}
                      aria-hidden="true"
                    />
                    <span>{assumption}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--aios-muted)]">无已记录假设</p>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold">Missing Information</h4>
            {plan.missingInformation.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm text-[var(--aios-muted)]">
                {plan.missingInformation.map((information) => (
                  <li key={information}>{information}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--aios-muted)]">
                无已记录缺失信息
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Bot
            size={19}
            className="text-[var(--aios-primary)]"
            aria-hidden="true"
          />
          <h3 className="font-semibold">执行步骤</h3>
          <Badge tone="info">{plan.steps.length} 步</Badge>
        </div>
        <ol className="mt-4 space-y-3">
          {[...plan.steps]
            .sort((left, right) => left.sequence - right.sequence)
            .map((step) => (
              <li
                key={step.id}
                aria-label={`步骤 ${step.sequence}：${step.name}`}
                className="grid gap-3 rounded-lg border border-[color-mix(in_srgb,var(--aios-muted)_22%,var(--aios-surface))] p-4 sm:grid-cols-[36px_minmax(0,1fr)]"
              >
                <span
                  className="grid size-9 place-items-center rounded-full bg-[var(--aios-primary)] text-sm font-bold text-white"
                  aria-hidden="true"
                >
                  {step.sequence}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{step.name}</h4>
                    <Badge>{step.stepType}</Badge>
                    <Badge tone={step.riskLevel === "R0" ? "success" : "warning"}>
                      {step.riskLevel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--aios-muted)]">
                    {step.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[var(--aios-muted)]">
                    Responsibility：{step.responsibility.replace(
                      "AI研发员工",
                      "AI 研发员工",
                    )}
                  </p>
                </div>
              </li>
            ))}
        </ol>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileCheck2
              size={19}
              className="text-[var(--aios-primary)]"
              aria-hidden="true"
            />
            <h3 className="font-semibold">ExpectedArtifact Contract</h3>
          </div>
          <p className="mt-3 text-sm">
            类型：<strong>{expectedArtifact.artifactType}</strong>
          </p>
          <p className="mt-2 text-sm text-[var(--aios-muted)]">
            {expectedArtifact.knowledgeCitationRequired
              ? "需要知识库引用"
              : "未要求知识库引用"}
          </p>
          <h4 className="mt-4 text-sm font-semibold">Required Sections</h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {expectedArtifact.sections.map((section) => (
              <li
                key={section}
                className="rounded-lg bg-[var(--aios-canvas)] px-3 py-2 text-sm"
              >
                {section}
              </li>
            ))}
          </ul>
          <h4 className="mt-4 text-sm font-semibold">Completion Criteria</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--aios-muted)]">
            {completionCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">ApprovalPoint</h3>
          {approvalPoints.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {approvalPoints.map((approval) => (
                <li
                  key={approval.id}
                  className="rounded-lg bg-[var(--aios-canvas)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold">{approval.name}</h4>
                    <Badge tone="warning">{approval.status}</Badge>
                    <Badge>{approval.riskLevel}</Badge>
                  </div>
                  <p className="mt-2 break-all text-xs leading-5 text-[var(--aios-muted)]">
                    Required For：{approval.requiredFor}
                  </p>
                  <p className="mt-1 break-all text-xs leading-5 text-[var(--aios-muted)]">
                    Reviewer：{approval.reviewerUserIds.join("、")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--aios-muted)]">
              当前无持久化 ApprovalPoint。
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
