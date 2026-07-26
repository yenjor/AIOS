import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TechnicalSolutionArtifact } from "./model";
import { ArtifactDetailScreen } from "./artifact-detail-screen";

const sectionTitles = [
  "目标理解",
  "范围与不做事项",
  "影响模块与文件",
  "技术决策",
  "风险",
  "测试建议",
  "回退考虑",
  "知识库引用",
] as const;

function artifact(): TechnicalSolutionArtifact {
  return {
    id: "artifact-task-mock-0001",
    scope: {
      organizationId: "org-guangwei",
      workspaceId: "ws-ai",
    },
    title: "Task Center 黄金路径 · 技术方案",
    artifactType: "技术方案",
    status: "PENDING_REVIEW",
    version: {
      artifactId: "artifact-task-mock-0001",
      versionId: "artifact-task-mock-0001-v1",
      versionNumber: 1,
      digest: "sha256:artifact-task-mock-0001-v1",
    },
    sections: sectionTitles.map((title) => ({
      title,
      paragraphs: [`${title}确定性正文。`],
    })),
    validationResults: [
      {
        id: "validation-structure",
        name: "Artifact 结构完整性",
        status: "PASSED",
        summary: "八个必需章节均已生成。",
      },
      {
        id: "validation-citation",
        name: "知识库引用可追溯",
        status: "PASSED",
        summary: "引用可追溯。",
      },
      {
        id: "validation-review",
        name: "Reviewer 人工验收",
        status: "PENDING",
        summary: "等待验收。",
      },
    ],
    citations: [
      {
        knowledgeVersionId: "knowledge-aios-docs-v1",
        locator: "README.md#5-系统整体架构",
        digest:
          "sha256:citation:knowledge-aios-docs-v1:readme-architecture",
      },
    ],
    provenance: {
      taskId: "task-mock-0001",
      runId: "run-task-mock-0001-01",
      agentVersionId: "agent-rd-001-v1",
      capabilityVersionIds: ["capability-technical-solution-v1"],
      knowledgeVersionIds: ["knowledge-aios-docs-v1"],
      workflowVersionId: "workflow-technical-solution-v1",
      toolVersionIds: ["tool-codegraph-read-v1"],
      generatedAt: "2026-07-26T09:00:00.000Z",
      contentDigest: "sha256:artifact-task-mock-0001-v1:content",
    },
    reviewerUserIds: ["user-lead"],
    createdAt: "2026-07-26T09:00:00.000Z",
    updatedAt: "2026-07-26T09:00:00.000Z",
  };
}

describe("ArtifactDetailScreen", () => {
  it("renders persisted content, provenance, citation, and review evidence", () => {
    render(
      <ArtifactDetailScreen
        artifact={artifact()}
        scopeLabels={{
          organizationName: "光位科技",
          workspaceName: "AI 智能业务线",
        }}
        viewer={{ name: "赵岚", role: "Auditor" }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Task Center 黄金路径 · 技术方案",
      }),
    ).toBeVisible();
    expect(screen.getByText("PENDING_REVIEW")).toBeVisible();
    for (const title of sectionTitles) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("agent-rd-001-v1")).toBeVisible();
    expect(screen.getByText("workflow-technical-solution-v1")).toBeVisible();
    expect(screen.getByText("README.md#5-系统整体架构")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "返回所属 Task" }),
    ).toHaveAttribute("href", "/tasks/task-mock-0001");
    expect(
      within(
        screen.getByRole("heading", { name: "Validation" }).parentElement!
          .parentElement!,
      ).getByText("Reviewer 人工验收"),
    ).toBeVisible();
  });

  it("shows the accepted reviewer identity without enabling mutation", () => {
    const accepted = artifact();
    accepted.status = "ACCEPTED";
    accepted.acceptedByUserId = "user-lead";
    accepted.acceptedAt = "2026-07-26T09:10:00.000Z";
    accepted.updatedAt = accepted.acceptedAt;
    accepted.validationResults[2].status = "PASSED";

    render(
      <ArtifactDetailScreen
        artifact={accepted}
        scopeLabels={{
          organizationName: "光位科技",
          workspaceName: "AI 智能业务线",
        }}
        viewer={{ name: "陈明", role: "研发负责人" }}
      />,
    );

    expect(screen.getByText("Artifact 已由 Reviewer 验收")).toBeVisible();
    expect(
      screen.getByText(/Accepted by user-lead/),
    ).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
