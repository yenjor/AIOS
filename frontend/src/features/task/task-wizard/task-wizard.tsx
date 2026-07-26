"use client";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

import {
  discardDraft,
  saveDraft,
  submitTechnicalSolutionTask,
} from "../mock/task-repository";
import type {
  TaskActor,
  TaskDraft,
  TaskScope,
  TaskWizardStep,
} from "../model";
import {
  APPROVAL_POINT_SUMMARIES,
  AIOS_KNOWLEDGE_REF,
  GOLDEN_TEMPLATE,
  READ_ONLY_TOOL_REF,
  TASK_WIZARD_STEPS,
  TASK_WIZARD_TEMPLATES,
  TECHNICAL_SOLUTION_CAPABILITY_REF,
  TECHNICAL_SOLUTION_SECTIONS,
  TECHNICAL_SOLUTION_WORKFLOW_REF,
} from "./wizard-config";
import {
  createInitialWizardValues,
  draftToWizardState,
  type TaskWizardValues,
  wizardStateToDraft,
} from "./wizard-state";
import {
  resolveWizardProgress,
  validateAllSteps,
  validateStep,
  type WizardErrors,
  type WizardField,
} from "./wizard-validation";

const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-3 py-2 text-sm text-[var(--aios-text)] focus-visible:outline-2 focus-visible:outline-[var(--aios-primary)]";
const labelClass = "mb-2 block text-sm font-semibold text-[var(--aios-text)]";
const supportingClass = "mt-2 text-xs leading-5 text-[var(--aios-muted)]";

const FIELD_STEPS: Record<WizardField, TaskWizardStep> = {
  templateName: 1,
  title: 2,
  goal: 2,
  currentProblem: 2,
  workScope: 2,
  priority: 2,
  riskLevel: 2,
  expectedCompletionLocal: 2,
  constraintsText: 2,
  outOfScopeText: 2,
  includeKnowledge: 3,
  completionCriteriaText: 4,
};

const FIELD_LABELS: Record<WizardField, string> = {
  templateName: "Task 模板",
  title: "Task 标题",
  goal: "Goal",
  currentProblem: "当前问题",
  workScope: "任务范围",
  priority: "Priority",
  riskLevel: "Risk",
  expectedCompletionLocal: "期望完成时间",
  constraintsText: "约束",
  outOfScopeText: "不做事项",
  includeKnowledge: "Knowledge Version",
  completionCriteriaText: "Completion Criteria",
};

export interface TaskWizardProps {
  scope: TaskScope;
  actor: TaskActor;
  initialDraft?: TaskDraft;
  scopeLabels: {
    organizationName: string;
    workspaceName: string;
  };
}

type OperationState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | {
      status: "error";
      kind: "save" | "discard" | "submit" | "stale";
    };

function FieldError({
  field,
  errors,
}: {
  field: WizardField;
  errors: WizardErrors;
}) {
  const error = errors[field];
  return error ? (
    <p
      className="mt-2 text-sm text-[var(--aios-error-foreground)]"
      id={`${field}-error`}
    >
      {error}
    </p>
  ) : null;
}

function describedBy(field: WizardField, errors: WizardErrors) {
  return errors[field] ? `${field}-help ${field}-error` : `${field}-help`;
}

function RefSummary({
  label,
  objectId,
  versionId,
  digest,
}: {
  label: string;
  objectId: string;
  versionId: string;
  digest: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold">{objectId}</p>
      <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
        {versionId}
      </p>
      <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
        {digest}
      </p>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--aios-muted)]">
        {description}
      </p>
    </div>
  );
}

function ErrorSummary({
  errors,
  onFocus,
}: {
  errors: WizardErrors;
  onFocus: (field: WizardField) => void;
}) {
  const entries = Object.entries(errors) as [WizardField, string][];
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] bg-[color-mix(in_srgb,var(--aios-error)_7%,var(--aios-surface))] p-4"
      role="alert"
      tabIndex={-1}
    >
      <p className="font-semibold">请修正以下内容后继续：</p>
      <div className="mt-2 grid gap-1">
        {entries.map(([field, message]) => (
          <button
            className="w-fit text-left text-sm text-[var(--aios-error-foreground)] underline underline-offset-2"
            key={field}
            type="button"
            onClick={() => onFocus(field)}
          >
            {FIELD_LABELS[field]}：{message}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TaskWizard({
  scope,
  actor,
  initialDraft,
  scopeLabels,
}: TaskWizardProps) {
  const router = useRouter();
  const restored = draftToWizardState(initialDraft);
  const restoredProgress = resolveWizardProgress(
    restored.currentStep,
    restored.values,
  );
  const [currentStep, setCurrentStep] = useState<TaskWizardStep>(
    restoredProgress.currentStep,
  );
  const [maxReachableStep, setMaxReachableStep] =
    useState<TaskWizardStep>(restoredProgress.maxReachableStep);
  const [values, setValues] = useState<TaskWizardValues>(restored.values);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [operation, setOperation] = useState<OperationState>({
    status: "idle",
  });
  const [hasDraft, setHasDraft] = useState(Boolean(initialDraft));
  const operationLockRef = useRef(false);
  const valuesRef = useRef(restored.values);
  const editRevisionRef = useRef(0);
  const requestRevisionRef = useRef(0);
  const mountedRef = useRef(true);

  const isGolden = values.templateName === GOLDEN_TEMPLATE;
  const isBusy = operation.status === "saving";

  useEffect(
    () => () => {
      mountedRef.current = false;
      requestRevisionRef.current += 1;
      operationLockRef.current = false;
    },
    [],
  );

  function updateValue<K extends keyof TaskWizardValues>(
    field: K,
    value: TaskWizardValues[K],
  ) {
    if (operationLockRef.current) {
      return;
    }
    const nextValues = { ...valuesRef.current, [field]: value };
    valuesRef.current = nextValues;
    editRevisionRef.current += 1;
    setValues(nextValues);
    const validatedMaximum = resolveWizardProgress(
      5,
      nextValues,
    ).maxReachableStep;
    setMaxReachableStep((current) =>
      Math.min(current, validatedMaximum) as TaskWizardStep,
    );
    setErrors((current) => {
      if (!Object.hasOwn(current, field)) {
        return current;
      }
      const next = { ...current };
      delete next[field as WizardField];
      return next;
    });
    if (operation.status === "saved") {
      setOperation({ status: "idle" });
    }
  }

  function focusField(field: WizardField) {
    const step = FIELD_STEPS[field];
    setCurrentStep(step);
    window.setTimeout(() => {
      document.getElementById(field)?.focus();
    }, 0);
  }

  function showErrors(nextErrors: WizardErrors) {
    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0] as
      | WizardField
      | undefined;
    if (firstField) {
      focusField(firstField);
    }
  }

  async function persistDraft(step: TaskWizardStep): Promise<boolean> {
    if (operationLockRef.current) {
      return false;
    }
    operationLockRef.current = true;
    const requestRevision = ++requestRevisionRef.current;
    const editRevision = editRevisionRef.current;
    const snapshot = wizardStateToDraft(valuesRef.current, step);
    setOperation({ status: "saving" });
    try {
      await saveDraft(scope, actor, snapshot);
      if (
        !mountedRef.current ||
        requestRevision !== requestRevisionRef.current
      ) {
        return false;
      }
      if (editRevision !== editRevisionRef.current) {
        setOperation({ status: "error", kind: "stale" });
        return false;
      }
      setHasDraft(true);
      setOperation({ status: "saved" });
      return true;
    } catch {
      if (
        mountedRef.current &&
        requestRevision === requestRevisionRef.current
      ) {
        setOperation({ status: "error", kind: "save" });
      }
      return false;
    } finally {
      if (requestRevision === requestRevisionRef.current) {
        operationLockRef.current = false;
      }
    }
  }

  async function handleNext() {
    const stepErrors = validateStep(currentStep, valuesRef.current);
    if (Object.keys(stepErrors).length > 0) {
      showErrors(stepErrors);
      return;
    }
    if (currentStep === 5) {
      return;
    }
    const nextStep = (currentStep + 1) as TaskWizardStep;
    if (await persistDraft(nextStep)) {
      setErrors({});
      setCurrentStep(nextStep);
      setMaxReachableStep((current) =>
        Math.max(current, nextStep) as TaskWizardStep,
      );
    }
  }

  async function handleBack() {
    if (currentStep === 1) {
      return;
    }
    const previousStep = (currentStep - 1) as TaskWizardStep;
    if (await persistDraft(previousStep)) {
      setErrors({});
      setCurrentStep(previousStep);
    }
  }

  async function handleStepSelect(step: TaskWizardStep) {
    if (
      step > maxReachableStep ||
      step === currentStep ||
      operationLockRef.current
    ) {
      return;
    }
    if (await persistDraft(step)) {
      setErrors({});
      setCurrentStep(step);
    }
  }

  async function handleDiscard() {
    const confirmed = window.confirm(
      "确认丢弃当前身份在此 Workspace 中的 Task 草稿？此操作无法撤销。",
    );
    if (!confirmed || operationLockRef.current) {
      return;
    }
    operationLockRef.current = true;
    const requestRevision = ++requestRevisionRef.current;
    setOperation({ status: "saving" });
    try {
      await discardDraft(scope, actor);
      if (
        !mountedRef.current ||
        requestRevision !== requestRevisionRef.current
      ) {
        return;
      }
      const resetValues = createInitialWizardValues();
      valuesRef.current = resetValues;
      editRevisionRef.current += 1;
      setValues(resetValues);
      setCurrentStep(1);
      setMaxReachableStep(1);
      setErrors({});
      setHasDraft(false);
      setOperation({ status: "idle" });
    } catch {
      if (
        mountedRef.current &&
        requestRevision === requestRevisionRef.current
      ) {
        setOperation({ status: "error", kind: "discard" });
      }
    } finally {
      if (requestRevision === requestRevisionRef.current) {
        operationLockRef.current = false;
      }
    }
  }

  async function handleSubmit() {
    if (!isGolden || operationLockRef.current) {
      return;
    }
    const allErrors = validateAllSteps(valuesRef.current);
    if (Object.keys(allErrors).length > 0) {
      showErrors(allErrors);
      return;
    }

    operationLockRef.current = true;
    const requestRevision = ++requestRevisionRef.current;
    const editRevision = editRevisionRef.current;
    const snapshot = wizardStateToDraft(valuesRef.current, 5);
    setOperation({ status: "saving" });
    try {
      await saveDraft(scope, actor, snapshot);
      if (
        !mountedRef.current ||
        requestRevision !== requestRevisionRef.current
      ) {
        return;
      }
      if (editRevision !== editRevisionRef.current) {
        setOperation({ status: "error", kind: "stale" });
        return;
      }
      const task = await submitTechnicalSolutionTask(scope, actor);
      if (
        !mountedRef.current ||
        requestRevision !== requestRevisionRef.current ||
        editRevision !== editRevisionRef.current
      ) {
        return;
      }
      router.push(`/tasks/${task.id}`);
    } catch {
      if (
        mountedRef.current &&
        requestRevision === requestRevisionRef.current
      ) {
        setOperation({ status: "error", kind: "submit" });
      }
    } finally {
      if (requestRevision === requestRevisionRef.current) {
        operationLockRef.current = false;
      }
    }
  }

  let stepContent: ReactNode;

  if (currentStep === 1) {
    stepContent = (
      <fieldset>
        <legend className="sr-only">选择 Task 模板</legend>
        <SectionHeading
          title="选择模板"
          description="模板定义预期 Artifact。当前迭代仅开放“生成技术方案”的提交闭环，其余模板可以完整保存为草稿。"
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TASK_WIZARD_TEMPLATES.map((template, index) => (
            <label
              className={cn(
                "cursor-pointer rounded-lg border p-4 transition focus-within:outline-2 focus-within:outline-[var(--aios-primary)]",
                values.templateName === template.name
                  ? "border-[var(--aios-primary)] bg-[color-mix(in_srgb,var(--aios-primary)_7%,var(--aios-surface))]"
                  : "border-[var(--aios-control-border)] bg-[var(--aios-surface)]",
              )}
              key={template.name}
            >
              <input
                aria-describedby={describedBy("templateName", errors)}
                className="mr-3 accent-[var(--aios-primary)]"
                id={
                  index === 0
                    ? "templateName"
                    : `template-${index + 1}`
                }
                name="template"
                type="radio"
                value={template.name}
                checked={values.templateName === template.name}
                onChange={() => updateValue("templateName", template.name)}
              />
              <span className="font-semibold">{template.name}</span>
              <span className="mt-2 block text-sm text-[var(--aios-muted)]">
                预期 Artifact：{template.artifactType}
              </span>
              {!template.submittable ? (
                <span className="mt-2 block text-xs text-[var(--aios-warning-foreground)]">
                  当前版本：仅保存草稿
                </span>
              ) : (
                <span className="mt-2 block text-xs text-[var(--aios-success-foreground)]">
                  可进入黄金路径
                </span>
              )}
            </label>
          ))}
        </div>
        <p className={supportingClass} id="templateName-help">
          选择不会启动 Agent、Workflow 或模型调用。
        </p>
        <FieldError field="templateName" errors={errors} />
      </fieldset>
    );
  } else if (currentStep === 2) {
    stepContent = (
      <div>
        <SectionHeading
          title="定义工作"
          description="把当前问题、目标、边界与时间约束写成可审查的 Task 定义。"
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className={labelClass} htmlFor="title">
              Task 标题
            </label>
            <input
              aria-describedby={describedBy("title", errors)}
              aria-invalid={Boolean(errors.title)}
              className={inputClass}
              id="title"
              maxLength={160}
              value={values.title}
              onChange={(event) => updateValue("title", event.target.value)}
            />
            <p className={supportingClass} id="title-help">
              使用具体动作和对象，最长 160 个字符。
            </p>
            <FieldError field="title" errors={errors} />
          </div>
          <div>
            <label className={labelClass} htmlFor="goal">
              Goal
            </label>
            <textarea
              aria-describedby={describedBy("goal", errors)}
              aria-invalid={Boolean(errors.goal)}
              className={cn(inputClass, "min-h-28 resize-y")}
              id="goal"
              value={values.goal}
              onChange={(event) => updateValue("goal", event.target.value)}
            />
            <p className={supportingClass} id="goal-help">
              描述完成后可验证的业务或研发结果。
            </p>
            <FieldError field="goal" errors={errors} />
          </div>
          <div>
            <label className={labelClass} htmlFor="currentProblem">
              当前问题
            </label>
            <textarea
              aria-describedby={describedBy("currentProblem", errors)}
              aria-invalid={Boolean(errors.currentProblem)}
              className={cn(inputClass, "min-h-28 resize-y")}
              id="currentProblem"
              value={values.currentProblem}
              onChange={(event) =>
                updateValue("currentProblem", event.target.value)
              }
            />
            <p className={supportingClass} id="currentProblem-help">
              说明现状、缺口与为何需要现在处理。
            </p>
            <FieldError field="currentProblem" errors={errors} />
          </div>
          <div>
            <label className={labelClass} htmlFor="workScope">
              任务范围
            </label>
            <textarea
              aria-describedby={describedBy("workScope", errors)}
              aria-invalid={Boolean(errors.workScope)}
              className={cn(inputClass, "min-h-24 resize-y")}
              id="workScope"
              value={values.workScope}
              onChange={(event) =>
                updateValue("workScope", event.target.value)
              }
            />
            <p className={supportingClass} id="workScope-help">
              明确允许分析和设计的模块、页面或业务过程。
            </p>
            <FieldError field="workScope" errors={errors} />
          </div>
          <div>
            <label className={labelClass} htmlFor="outOfScopeText">
              不做事项
            </label>
            <textarea
              aria-describedby={describedBy("outOfScopeText", errors)}
              aria-invalid={Boolean(errors.outOfScopeText)}
              className={cn(inputClass, "min-h-24 resize-y")}
              id="outOfScopeText"
              value={values.outOfScopeText}
              onChange={(event) =>
                updateValue("outOfScopeText", event.target.value)
              }
            />
            <p className={supportingClass} id="outOfScopeText-help">
              每行一项，写明不可接受的结果或本次明确排除的工作。
            </p>
            <FieldError field="outOfScopeText" errors={errors} />
          </div>
          <div>
            <label className={labelClass} htmlFor="constraintsText">
              约束
            </label>
            <textarea
              aria-describedby={describedBy("constraintsText", errors)}
              aria-invalid={Boolean(errors.constraintsText)}
              className={cn(inputClass, "min-h-24 resize-y")}
              id="constraintsText"
              value={values.constraintsText}
              onChange={(event) =>
                updateValue("constraintsText", event.target.value)
              }
            />
            <p className={supportingClass} id="constraintsText-help">
              每行一项，例如架构、权限、质量或交付约束。
            </p>
            <FieldError field="constraintsText" errors={errors} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="priority">
                Priority
              </label>
              <input
                aria-describedby={describedBy("priority", errors)}
                aria-invalid={Boolean(errors.priority)}
                className={inputClass}
                id="priority"
                max={100}
                min={0}
                step={1}
                type="number"
                value={values.priority}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateValue("priority", Number(event.target.value))
                }
              />
              <p className={supportingClass} id="priority-help">
                0 最高、100 最低；默认 50。
              </p>
              <FieldError field="priority" errors={errors} />
            </div>
            <div>
              <label className={labelClass} htmlFor="riskLevel">
                Risk
              </label>
              <select
                aria-describedby={describedBy("riskLevel", errors)}
                aria-invalid={Boolean(errors.riskLevel)}
                className={inputClass}
                id="riskLevel"
                value={
                  values.riskLevel === "R0" ||
                  values.riskLevel === "R1"
                    ? values.riskLevel
                    : ""
                }
                onChange={(event) =>
                  updateValue(
                    "riskLevel",
                    event.target.value as "R0" | "R1",
                  )
                }
              >
                <option disabled value="">
                  请选择 R0 / R1
                </option>
                <option value="R0">R0</option>
                <option value="R1">R1</option>
              </select>
              <p className={supportingClass} id="riskLevel-help">
                试点仅允许 R0 / R1；R2 / R3 不可提交。
                {values.riskLevel === "R2" ||
                values.riskLevel === "R3"
                  ? ` 当前旧草稿为 ${values.riskLevel}，请选择 R0 或 R1。`
                  : ""}
              </p>
              <FieldError field="riskLevel" errors={errors} />
            </div>
            <div>
              <label
                className={labelClass}
                htmlFor="expectedCompletionLocal"
              >
                期望完成时间
              </label>
              <input
                aria-describedby={describedBy(
                  "expectedCompletionLocal",
                  errors,
                )}
                aria-invalid={Boolean(errors.expectedCompletionLocal)}
                className={inputClass}
                id="expectedCompletionLocal"
                type="datetime-local"
                value={values.expectedCompletionLocal}
                onChange={(event) =>
                  updateValue(
                    "expectedCompletionLocal",
                    event.target.value,
                  )
                }
              />
              <p
                className={supportingClass}
                id="expectedCompletionLocal-help"
              >
                按本地时区录入，保存时转换为严格 UTC ISO 时间。
              </p>
              <FieldError
                field="expectedCompletionLocal"
                errors={errors}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } else if (currentStep === 3) {
    stepContent = (
      <div>
        <SectionHeading
          title="提供上下文"
          description="仅绑定当前 Workspace 已授权且版本固定的 Knowledge 引用，不保存 Knowledge 正文或 Secret。"
        />
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">
            授权 Knowledge Version
          </legend>
          <label
            className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4"
            htmlFor="includeKnowledge"
          >
            <input
              aria-describedby={describedBy("includeKnowledge", errors)}
              aria-invalid={Boolean(errors.includeKnowledge)}
              checked={values.includeKnowledge}
              className="mt-1 accent-[var(--aios-primary)]"
              id="includeKnowledge"
              type="checkbox"
              onChange={(event) =>
                updateValue("includeKnowledge", event.target.checked)
              }
            />
            <span className="min-w-0">
              <span className="block font-semibold">AIOS 项目文档</span>
              <span className="mt-1 block break-all font-mono text-xs text-[var(--aios-muted)]">
                {AIOS_KNOWLEDGE_REF.versionId}
              </span>
              <span className="mt-1 block break-all font-mono text-xs text-[var(--aios-muted)]">
                {AIOS_KNOWLEDGE_REF.digest}
              </span>
            </span>
          </label>
          <p className={supportingClass} id="includeKnowledge-help">
            仅保存 KnowledgeVersionRef；检索时仍需再次执行权限校验。
          </p>
          <FieldError field="includeKnowledge" errors={errors} />
        </fieldset>
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--aios-control-border)] p-4">
          <Info
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--aios-info-foreground)]"
            size={19}
          />
          <p className="text-sm leading-6 text-[var(--aios-muted)]">
            当前 Mock TaskDraft 尚未建模任务材料引用、关联 Task/Artifact、
            权威来源与敏感范围。这些内容不会被假装持久化；本步骤只实现已有的
            KnowledgeVersionRef 边界。
          </p>
        </div>
      </div>
    );
  } else if (currentStep === 4) {
    const selectedTemplate =
      values.templateName ?? TASK_WIZARD_TEMPLATES[0].name;
    const artifact = TASK_WIZARD_TEMPLATES.find(
      ({ name }) => name === selectedTemplate,
    )!;
    stepContent = (
      <div>
        <SectionHeading
          title="定义成果"
          description="确认预期 Artifact 的类型、必备章节、检查条件与人工 Reviewer。"
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm text-[var(--aios-muted)]">Artifact 类型</p>
            <p className="mt-2 text-lg font-semibold">
              {artifact.artifactType}
            </p>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              Reviewer：陈明（user-lead）
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold">可接受 Risk</p>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              当前黄金路径限定 R0 / R1；任务默认 R1。R2 / R3
              不在本次试点提交范围。
            </p>
          </Card>
          <fieldset className="lg:col-span-2">
            <legend className="text-sm font-semibold">
              Must include / Sections
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(isGolden
                ? TECHNICAL_SOLUTION_SECTIONS
                : [
                    "目标与范围",
                    "执行结果",
                    "风险与建议",
                    "Knowledge Citation",
                  ]
              ).map((section) => (
                <label
                  className="flex items-center gap-3 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-3 text-sm"
                  key={section}
                >
                  <input
                    checked
                    className="accent-[var(--aios-primary)]"
                    disabled
                    readOnly
                    type="checkbox"
                  />
                  {section}
                </label>
              ))}
            </div>
          </fieldset>
          <section
            aria-labelledby="artifact-required-checks"
            className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-5 lg:col-span-2"
          >
            <h3
              className="text-sm font-semibold"
              id="artifact-required-checks"
            >
              必须通过的检查
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {
                  name: "Artifact 结构完整性",
                  detail: "必须包含所列 Sections，且关键结论完整。",
                },
                {
                  name: "Knowledge Citation 可追溯",
                  detail: "关键结论必须引用已授权 KnowledgeVersion。",
                },
                {
                  name: "Reviewer 人工验收",
                  detail: "陈明（user-lead）验收后方可完成 Task。",
                },
              ].map((check) => (
                <div
                  className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] p-4"
                  key={check.name}
                >
                  <p className="font-semibold">{check.name}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--aios-muted)]">
                    {check.detail}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[var(--aios-warning-foreground)]">
                    提交后验证
                  </p>
                </div>
              ))}
            </div>
          </section>
          <div className="lg:col-span-2">
            <label
              className={labelClass}
              htmlFor="completionCriteriaText"
            >
              Completion Criteria
            </label>
            <textarea
              aria-describedby={describedBy(
                "completionCriteriaText",
                errors,
              )}
              aria-invalid={Boolean(errors.completionCriteriaText)}
              className={cn(inputClass, "min-h-28 resize-y")}
              id="completionCriteriaText"
              value={values.completionCriteriaText}
              onChange={(event) =>
                updateValue(
                  "completionCriteriaText",
                  event.target.value,
                )
              }
            />
            <p
              className={supportingClass}
              id="completionCriteriaText-help"
            >
              每行一项。至少包括结构检查、引用检查与人工验收条件。
            </p>
            <FieldError
              field="completionCriteriaText"
              errors={errors}
            />
          </div>
        </div>
      </div>
    );
  } else {
    stepContent = (
      <div>
        <SectionHeading
          title="确认执行"
          description="以下内容是提交后用于生成 Execution Plan 的固定、只读版本引用。此页面不会启动执行。"
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="min-w-0 p-5 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
              Task 定义
            </p>
            <h3 className="mt-2 break-words text-lg font-semibold">
              {values.title || "尚未填写标题"}
            </h3>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--aios-muted)]">Goal</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {values.goal || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--aios-muted)]">当前问题</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {values.currentProblem || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--aios-muted)]">任务范围</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {values.workScope || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--aios-muted)]">
                  Priority / Risk / 期望完成时间
                </dt>
                <dd className="mt-1 break-words">
                  {values.priority} / {values.riskLevel} /{" "}
                  {values.expectedCompletionLocal || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--aios-muted)]">约束</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {values.constraintsText || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--aios-muted)]">不做事项</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {values.outOfScopeText || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--aios-muted)]">
                  Completion Criteria
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {values.completionCriteriaText || "—"}
                </dd>
              </div>
            </dl>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
              执行身份
            </p>
            <p className="mt-2 font-semibold">
              AI研发员工（agent-rd-001）
            </p>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              L1辅助 · Human Owner / Reviewer：陈明（user-lead）
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
              Scope / Visibility
            </p>
            <p className="mt-2 break-words font-semibold">
              {scopeLabels.organizationName} / {scopeLabels.workspaceName}
            </p>
            <p className="mt-2 text-sm text-[var(--aios-muted)]">
              Workspace 成员可见；草稿按 actor 隔离。
            </p>
          </Card>
          <RefSummary
            label="CapabilityVersion"
            {...TECHNICAL_SOLUTION_CAPABILITY_REF}
          />
          <RefSummary
            label="KnowledgeVersion"
            {...AIOS_KNOWLEDGE_REF}
          />
          <RefSummary
            label="WorkflowVersion"
            {...TECHNICAL_SOLUTION_WORKFLOW_REF}
          />
          <div className="min-w-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
              PlanVersion
            </p>
            <p className="mt-2 text-sm font-semibold">尚未生成</p>
            <p className="mt-1 text-xs leading-5 text-[var(--aios-muted)]">
              提交后由 Task Engine 根据固定 Workflow 生成并锁定
              PlanVersionRef；当前页面不预造对象 ID 或摘要。
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-canvas)] p-4 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--aios-muted)]">
              ToolVersion / 最小权限
            </p>
            <p className="mt-2 break-words text-sm font-semibold">
              {READ_ONLY_TOOL_REF.objectId}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-[var(--aios-muted)]">
              {READ_ONLY_TOOL_REF.actionId}
            </p>
            <span className="mt-3 inline-flex rounded-full border border-[var(--aios-control-border)] px-3 py-1 text-xs font-semibold">
              {READ_ONLY_TOOL_REF.operationType}
            </span>
          </div>
          <Card className="p-5 lg:col-span-2">
            <p className="text-sm font-semibold">Approval Points</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {APPROVAL_POINT_SUMMARIES.map((point) => (
                <div
                  className="rounded-lg bg-[var(--aios-canvas)] p-4"
                  key={point.name}
                >
                  <p className="font-semibold">{point.name}</p>
                  <p className="mt-1 text-xs text-[var(--aios-muted)]">
                    {point.requiredFor} · {point.riskLevel}
                  </p>
                  <p className="mt-1 text-xs text-[var(--aios-muted)]">
                    {point.reviewer}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        {!isGolden ? (
          <div
            className="mt-6 rounded-lg border border-[color-mix(in_srgb,var(--aios-warning)_35%,var(--aios-surface))] bg-[color-mix(in_srgb,var(--aios-warning)_7%,var(--aios-surface))] p-4 text-sm text-[var(--aios-warning-foreground)]"
            id="submit-disabled-reason"
          >
            当前版本仅支持保存草稿。“生成技术方案”是唯一可提交的黄金路径；
            本模板不会伪造 Agent、Workflow 或 Artifact 执行结果。
          </div>
        ) : null}
      </div>
    );
  }

  const operationMessage =
    operation.status === "error"
      ? {
          save: "草稿保存失败。输入仍保留，可以重试保存。",
          discard: "草稿丢弃失败。现有草稿与输入均未被清除。",
          submit: "Task 提交失败。草稿与输入仍保留，可以重试提交。",
          stale:
            "检测到保存期间内容发生变化，未将旧快照标记为已保存。请保存最新内容后继续。",
        }[operation.kind]
      : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--aios-primary)]">
            Task Center / Create
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            创建 Task
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--aios-muted)]">
            将研发工作定义成可追踪、可审批、可恢复的 Task。提交只创建
            Task 与待确认计划，不直接执行 AI 行为。
          </p>
        </div>
        <div className="rounded-lg border border-[var(--aios-control-border)] bg-[var(--aios-surface)] px-4 py-3 text-sm">
          <span className="text-[var(--aios-muted)]">当前范围：</span>
          <span className="font-semibold">
            {scopeLabels.organizationName} / {scopeLabels.workspaceName}
          </span>
        </div>
      </header>

      <nav aria-label="Task 创建步骤" className="mt-6">
        <ol className="grid gap-2 sm:grid-cols-5">
          {TASK_WIZARD_STEPS.map(({ step, label }) => (
            <li
              className="min-w-0"
              key={step}
            >
              <button
                aria-current={
                  step === currentStep ? "step" : undefined
                }
                aria-label={`第 ${step} 步：${label}`}
                className={cn(
                  "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aios-primary)] disabled:cursor-not-allowed disabled:opacity-55",
                  step === currentStep
                    ? "border-[var(--aios-primary)] bg-[color-mix(in_srgb,var(--aios-primary)_7%,var(--aios-surface))] font-semibold text-[var(--aios-primary)]"
                    : step < maxReachableStep
                      ? "border-[color-mix(in_srgb,var(--aios-success)_35%,var(--aios-surface))] bg-[var(--aios-surface)]"
                      : "border-[var(--aios-control-border)] bg-[var(--aios-surface)] text-[var(--aios-muted)]",
                )}
                disabled={
                  step > maxReachableStep ||
                  operation.status === "saving"
                }
                type="button"
                onClick={() => void handleStepSelect(step)}
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs"
                >
                  {step < maxReachableStep ? (
                    <Check size={14} />
                  ) : (
                    step
                  )}
                </span>
                <span className="break-words">{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6 grid gap-4">
        <ErrorSummary errors={errors} onFocus={focusField} />
        {operationMessage ? (
          <div
            className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--aios-error)_35%,var(--aios-surface))] bg-[color-mix(in_srgb,var(--aios-error)_7%,var(--aios-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span className="flex items-start gap-2 text-sm">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--aios-error-foreground)]"
                size={18}
              />
              {operationMessage}
            </span>
            {operation.status === "error" &&
            (operation.kind === "save" ||
              operation.kind === "stale") ? (
              <Button
                variant="secondary"
                onClick={() => void persistDraft(currentStep)}
              >
                重试保存
              </Button>
            ) : operation.status === "error" &&
              operation.kind === "submit" ? (
              <Button
                variant="secondary"
                onClick={() => void handleSubmit()}
              >
                重试提交
              </Button>
            ) : null}
          </div>
        ) : null}
        {operation.status === "saved" ? (
          <p
            className="text-sm text-[var(--aios-success-foreground)]"
            role="status"
          >
            草稿已保存到当前 actor 与 Workspace 的隔离空间。
          </p>
        ) : null}
      </div>

      <Card className="mt-4 min-w-0 p-4 sm:p-6">
        <fieldset
          aria-busy={isBusy}
          className="m-0 min-w-0 border-0 p-0"
          disabled={isBusy}
        >
          {stepContent}
        </fieldset>
      </Card>

      <footer className="mt-5 flex flex-col-reverse gap-3 border-t border-[var(--aios-control-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          {currentStep > 1 ? (
            <Button
              disabled={operation.status === "saving"}
              variant="secondary"
              onClick={() => void handleBack()}
            >
              <ChevronLeft aria-hidden="true" size={17} />
              上一步
            </Button>
          ) : null}
          {hasDraft ? (
            <Button
              disabled={operation.status === "saving"}
              variant="danger"
              onClick={() => void handleDiscard()}
            >
              <Trash2 aria-hidden="true" size={17} />
              丢弃草稿
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            disabled={operation.status === "saving"}
            variant="secondary"
            onClick={() => void persistDraft(currentStep)}
          >
            <Save aria-hidden="true" size={17} />
            保存草稿
          </Button>
          {currentStep < 5 ? (
            <Button
              disabled={operation.status === "saving"}
              onClick={() => void handleNext()}
            >
              下一步
              <ChevronRight aria-hidden="true" size={17} />
            </Button>
          ) : (
            <Button
              aria-describedby={
                isGolden ? undefined : "submit-disabled-reason"
              }
              disabled={!isGolden || operation.status === "saving"}
              onClick={() => void handleSubmit()}
            >
              <Send aria-hidden="true" size={17} />
              提交 Task
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
