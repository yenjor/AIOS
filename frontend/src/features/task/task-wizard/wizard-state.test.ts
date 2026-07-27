import { describe, expect, it } from "vitest";

import {
  createInitialWizardValues,
  draftToWizardState,
  wizardStateToDraft,
} from "./wizard-state";
import { TECHNICAL_SOLUTION_CAPABILITY_REF } from "./wizard-config";
import {
  buildTechnicalSolutionDraft,
  resolveWizardProgress,
  validateAllSteps,
  validateStep,
} from "./wizard-validation";

describe("任务 wizard state", () => {
  it("round-trips the modeled definition fields without adding unsupported draft keys", () => {
    const values = createInitialWizardValues();
    values.templateName = "生成技术方案";
    values.title = "生成任务中心技术方案";
    values.goal = "形成可评审方案";
    values.currentProblem = "任务缺少可执行定义";
    values.workScope = "任务中心页面";
    values.expectedCompletionLocal = "2026-08-01T18:00";
    values.constraintsText = "遵循现有架构";
    values.outOfScopeText = "不改后端";
    values.completionCriteriaText = "结构完整\n引用可追溯";
    values.includeKnowledge = true;

    const draft = wizardStateToDraft(
      values,
      5,
      TECHNICAL_SOLUTION_CAPABILITY_REF,
    );

    expect(Object.keys(draft).sort()).toEqual(
      [
        "assignedAgent",
        "capabilityVersionRefs",
        "completionCriteria",
        "constraints",
        "currentProblem",
        "expectedArtifact",
        "expectedCompletionAt",
        "goal",
        "knowledgeVersionRefs",
        "outOfScope",
        "priority",
        "riskLevel",
        "templateName",
        "title",
        "toolVersionRefs",
        "wizardStep",
        "workScope",
      ].sort(),
    );
    expect(draft.constraints).toEqual(["遵循现有架构"]);
    expect(draft.currentProblem).toBe("任务缺少可执行定义");
    expect(draft.workScope).toBe("任务中心页面");
    expect(draft.expectedCompletionAt).toMatch(
      /^2026-08-01T\d{2}:00:00\.000Z$/,
    );

    const restored = draftToWizardState(draft);
    expect(restored.values).toMatchObject(values);
    expect(restored.currentStep).toBe(5);
  });

  it("restores the exact repository-backed wizard step", () => {
    expect(draftToWizardState(undefined).currentStep).toBe(1);
    expect(
      draftToWizardState({
        wizardStep: 4,
        templateName: "分析需求",
      }).currentStep,
    ).toBe(4);
    expect(
      draftToWizardState({
        wizardStep: 2,
        templateName: "分析需求",
        title: "分析需求",
        goal: "明确目标",
        currentProblem: "范围不清",
        workScope: "需求分析",
        constraints: ["遵循架构"],
        outOfScope: ["不改代码"],
        priority: 50,
        riskLevel: "R1",
      }).currentStep,
    ).toBe(2);
  });
});

describe("任务 wizard validation", () => {
  it("clamps forged progress to the first incomplete step while preserving valid current steps", () => {
    const incomplete = createInitialWizardValues();
    incomplete.templateName = "生成技术方案";
    expect(resolveWizardProgress(5, incomplete)).toEqual({
      currentStep: 2,
      maxReachableStep: 2,
    });

    const complete = createInitialWizardValues();
    Object.assign(complete, {
      templateName: "生成技术方案",
      title: "完整草稿",
      goal: "形成方案",
      currentProblem: "缺少方案",
      workScope: "任务中心",
      expectedCompletionLocal: "2026-08-01T18:00",
      constraintsText: "遵循架构",
      outOfScopeText: "不改后端",
      completionCriteriaText: "结构完整",
      includeKnowledge: true,
    });
    expect(resolveWizardProgress(3, complete)).toEqual({
      currentStep: 3,
      maxReachableStep: 5,
    });
  });

  it("validates one step at a time and all steps before submit", () => {
    const values = createInitialWizardValues();
    expect(validateStep(1, values)).toHaveProperty("templateName");

    values.templateName = "生成技术方案";
    expect(validateStep(1, values)).toEqual({});
    expect(validateStep(2, values)).toMatchObject({
      title: expect.any(String),
      goal: expect.any(String),
    });
    expect(validateAllSteps(values)).toHaveProperty("completionCriteriaText");
  });

  it.each(["R2", "R3"] as const)(
    "rejects legacy %s risk drafts in step and final validation",
    (riskLevel) => {
      const values = createInitialWizardValues();
      Object.assign(values, {
        templateName: "生成技术方案",
        title: "高风险旧草稿",
        goal: "形成方案",
        currentProblem: "缺少方案",
        workScope: "任务中心",
        expectedCompletionLocal: "2026-08-01T18:00",
        constraintsText: "遵循架构",
        outOfScopeText: "不改后端",
        completionCriteriaText: "结构完整",
        includeKnowledge: true,
        riskLevel,
      });

      expect(validateStep(2, values)).toHaveProperty("riskLevel");
      expect(validateAllSteps(values)).toHaveProperty("riskLevel");
      expect(() => buildTechnicalSolutionDraft(values)).toThrow(
        "尚未填写完整",
      );
    },
  );

  it("builds the only submittable technical-solution draft with fixed refs", () => {
    const values = createInitialWizardValues();
    Object.assign(values, {
      templateName: "生成技术方案",
      title: "生成任务中心技术方案",
      goal: "形成可评审方案",
      currentProblem: "需要统一任务定义",
      workScope: "任务中心",
      expectedCompletionLocal: "2026-08-01T18:00",
      constraintsText: "遵循现有架构",
      outOfScopeText: "不改后端",
      completionCriteriaText: "结构完整",
      includeKnowledge: true,
    });

    const draft = buildTechnicalSolutionDraft(values);
    expect(draft.assignedAgent).toMatchObject({
      agentId: "agent-rd-001",
      autonomyLevel: "L1辅助",
      humanOwner: { userId: "user-lead", displayName: "陈明" },
    });
    expect(draft.toolVersionRefs).toEqual([
      expect.objectContaining({ operationType: "READ" }),
    ]);
    expect(draft.riskLevel).toBe("R1");
    expect(draft.expectedArtifact?.artifactType).toBe("技术方案");
  });
});
