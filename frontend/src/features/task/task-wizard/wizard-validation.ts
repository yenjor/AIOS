import type { TaskDraft, TaskWizardStep } from "../model";
import {
  GOLDEN_TEMPLATE,
  TECHNICAL_SOLUTION_CAPABILITY_REF,
} from "./wizard-config";
import {
  localDateTimeToIso,
  type TaskWizardValues,
  wizardStateToDraft,
} from "./wizard-state";

export type WizardField =
  | "templateName"
  | "capabilityVersionId"
  | "title"
  | "goal"
  | "currentProblem"
  | "workScope"
  | "priority"
  | "riskLevel"
  | "expectedCompletionLocal"
  | "constraintsText"
  | "outOfScopeText"
  | "includeKnowledge"
  | "completionCriteriaText";

export type WizardErrors = Partial<Record<WizardField, string>>;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateStep(
  step: TaskWizardStep,
  values: TaskWizardValues,
): WizardErrors {
  const errors: WizardErrors = {};

  if (step === 1 && !values.templateName) {
    errors.templateName = "请选择一个 Task 模板。";
  }

  if (step === 2) {
    if (isBlank(values.title)) {
      errors.title = "请输入 Task 标题。";
    }
    if (isBlank(values.goal)) {
      errors.goal = "请输入清晰、可验证的 Goal。";
    }
    if (isBlank(values.currentProblem)) {
      errors.currentProblem = "请说明当前问题。";
    }
    if (isBlank(values.workScope)) {
      errors.workScope = "请定义本次工作的范围。";
    }
    if (
      !Number.isInteger(values.priority) ||
      values.priority < 0 ||
      values.priority > 100
    ) {
      errors.priority = "Priority 必须是 0 到 100 之间的整数。";
    }
    if (values.riskLevel !== "R0" && values.riskLevel !== "R1") {
      errors.riskLevel = "当前试点只允许 R0 或 R1 风险等级。";
    }
    if (
      !values.expectedCompletionLocal ||
      !localDateTimeToIso(values.expectedCompletionLocal)
    ) {
      errors.expectedCompletionLocal = "请选择有效的期望完成时间。";
    }
    if (isBlank(values.constraintsText)) {
      errors.constraintsText = "请至少提供一项约束。";
    }
    if (isBlank(values.outOfScopeText)) {
      errors.outOfScopeText = "请至少提供一项不做事项。";
    }
  }

  if (
    step === 3 &&
    values.templateName === GOLDEN_TEMPLATE &&
    !values.includeKnowledge
  ) {
    errors.includeKnowledge =
      "黄金路径必须绑定一个已授权的知识库版本。";
  }
  if (
    step === 3 &&
    values.templateName === GOLDEN_TEMPLATE &&
    !values.capabilityVersionId
  ) {
    errors.capabilityVersionId =
      "请选择一个当前 Workspace 可用的 Published 能力版本。";
  }

  if (step === 4 && isBlank(values.completionCriteriaText)) {
    errors.completionCriteriaText = "请至少提供一项 Completion Criteria。";
  }

  return errors;
}

export function validateAllSteps(
  values: TaskWizardValues,
): WizardErrors {
  return ([1, 2, 3, 4] as const).reduce<WizardErrors>(
    (allErrors, step) => ({
      ...allErrors,
      ...validateStep(step, values),
    }),
    {},
  );
}

export interface WizardProgress {
  currentStep: TaskWizardStep;
  maxReachableStep: TaskWizardStep;
}

export function resolveWizardProgress(
  requestedStep: TaskWizardStep,
  values: TaskWizardValues,
): WizardProgress {
  for (const step of [1, 2, 3, 4] as const) {
    if (Object.keys(validateStep(step, values)).length > 0) {
      return {
        currentStep: Math.min(requestedStep, step) as TaskWizardStep,
        maxReachableStep: step,
      };
    }
  }

  return {
    currentStep: requestedStep,
    maxReachableStep: 5,
  };
}

export function buildTechnicalSolutionDraft(
  values: TaskWizardValues,
): TaskDraft {
  if (values.templateName !== GOLDEN_TEMPLATE) {
    throw new Error("Only the technical-solution template can be submitted.");
  }
  const errors = validateAllSteps(values);
  if (Object.keys(errors).length > 0) {
    throw new Error("The Task wizard is incomplete.");
  }
  return wizardStateToDraft(
    values,
    5,
    TECHNICAL_SOLUTION_CAPABILITY_REF,
  );
}
