import type {
  CapabilityVersionRef,
  TaskDraft,
  TaskWizardStep,
} from "../model";
import type {
  RiskLevel,
  TaskTemplateName,
} from "../task-status";
import {
  AGENT_ASSIGNMENT,
  AIOS_KNOWLEDGE_REF,
  expectedArtifactFor,
  GOLDEN_TEMPLATE,
  READ_ONLY_TOOL_REF,
  TECHNICAL_SOLUTION_CAPABILITY_REF,
} from "./wizard-config";

export interface TaskWizardValues {
  templateName?: TaskTemplateName;
  capabilityVersionId: string;
  title: string;
  goal: string;
  currentProblem: string;
  workScope: string;
  priority: number;
  expectedCompletionLocal: string;
  outOfScopeText: string;
  constraintsText: string;
  riskLevel: RiskLevel;
  includeKnowledge: boolean;
  completionCriteriaText: string;
}

export interface TaskWizardState {
  currentStep: TaskWizardStep;
  values: TaskWizardValues;
}

export function createInitialWizardValues(): TaskWizardValues {
  return {
    capabilityVersionId: TECHNICAL_SOLUTION_CAPABILITY_REF.versionId,
    title: "",
    goal: "",
    currentProblem: "",
    workScope: "",
    priority: 50,
    expectedCompletionLocal: "",
    outOfScopeText: "",
    constraintsText: "",
    riskLevel: "R1",
    includeKnowledge: true,
    completionCriteriaText: "",
  };
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function localDateTimeToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function isoToLocalDateTime(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function draftToWizardState(
  draft: TaskDraft | undefined,
): TaskWizardState {
  const defaults = createInitialWizardValues();
  if (!draft) {
    return { currentStep: 1, values: defaults };
  }

  return {
    currentStep: draft.wizardStep ?? 1,
    values: {
      ...defaults,
      templateName: draft.templateName,
      capabilityVersionId:
        draft.capabilityVersionRefs?.[0]?.versionId ??
        defaults.capabilityVersionId,
      title: draft.title ?? "",
      goal: draft.goal ?? "",
      currentProblem: draft.currentProblem ?? "",
      workScope: draft.workScope ?? "",
      priority: draft.priority ?? defaults.priority,
      expectedCompletionLocal: isoToLocalDateTime(
        draft.expectedCompletionAt,
      ),
      outOfScopeText: draft.outOfScope?.join("\n") ?? "",
      constraintsText: draft.constraints?.join("\n") ?? "",
      riskLevel: draft.riskLevel ?? defaults.riskLevel,
      includeKnowledge: Boolean(draft.knowledgeVersionRefs?.length),
      completionCriteriaText:
        draft.completionCriteria?.join("\n") ?? "",
    },
  };
}

export function wizardStateToDraft(
  values: TaskWizardValues,
  wizardStep: TaskWizardStep = 5,
  capabilityVersionRef?: CapabilityVersionRef,
): TaskDraft {
  const expectedCompletionAt = localDateTimeToIso(
    values.expectedCompletionLocal,
  );
  const constraints = lines(values.constraintsText);
  const outOfScope = lines(values.outOfScopeText);
  const completionCriteria = lines(values.completionCriteriaText);
  const technicalSolution = values.templateName === GOLDEN_TEMPLATE;

  return {
    wizardStep,
    ...(values.templateName ? { templateName: values.templateName } : {}),
    ...(optionalText(values.title) ? { title: values.title.trim() } : {}),
    ...(optionalText(values.goal) ? { goal: values.goal.trim() } : {}),
    ...(optionalText(values.currentProblem)
      ? { currentProblem: values.currentProblem.trim() }
      : {}),
    ...(optionalText(values.workScope)
      ? { workScope: values.workScope.trim() }
      : {}),
    ...(expectedCompletionAt ? { expectedCompletionAt } : {}),
    priority: values.priority,
    riskLevel: values.riskLevel,
    ...(constraints.length > 0 ? { constraints } : {}),
    ...(outOfScope.length > 0 ? { outOfScope } : {}),
    ...(values.includeKnowledge
      ? { knowledgeVersionRefs: [{ ...AIOS_KNOWLEDGE_REF }] }
      : {}),
    ...(technicalSolution && capabilityVersionRef
      ? {
          capabilityVersionRefs: [
            { ...capabilityVersionRef },
          ],
          toolVersionRefs: [{ ...READ_ONLY_TOOL_REF }],
          assignedAgent: structuredClone(AGENT_ASSIGNMENT),
        }
      : {}),
    ...(values.templateName
      ? { expectedArtifact: expectedArtifactFor(values.templateName) }
      : {}),
    ...(completionCriteria.length > 0 ? { completionCriteria } : {}),
  };
}
