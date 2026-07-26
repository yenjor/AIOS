import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeCenterLoader } from "./knowledge-center-loader";

const {
  getKnowledgePermission,
  getKnowledgeSummary,
  listKnowledge,
  useSession,
} = vi.hoisted(() => ({
  getKnowledgePermission: vi.fn(),
  getKnowledgeSummary: vi.fn(),
  listKnowledge: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/features/session/session-provider", () => ({
  useSession,
}));

vi.mock("./mock/knowledge-repository", () => ({
  getKnowledgePermission,
  getKnowledgeSummary,
  listKnowledge,
  KnowledgeRepositoryError: class KnowledgeRepositoryError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const completeSession = {
  hydrated: true,
  user: { id: "user-lead", name: "陈明", role: "研发负责人" },
  organization: { id: "org-guangwei", name: "光位科技" },
  workspace: {
    id: "ws-ai",
    organizationId: "org-guangwei",
    name: "AI 智能业务线",
  },
};

beforeEach(() => {
  useSession.mockReset();
  getKnowledgePermission.mockReset();
  getKnowledgeSummary.mockReset();
  listKnowledge.mockReset();
  useSession.mockReturnValue(completeSession);
  getKnowledgePermission.mockResolvedValue({
    canRead: true,
    canManage: true,
    canSubmitCorrection: true,
    reason: "Allowed.",
  });
  getKnowledgeSummary.mockResolvedValue({
    total: 4,
    effective: 3,
    draft: 1,
    attention: 1,
  });
  listKnowledge.mockResolvedValue({
    total: 0,
    page: 1,
    pageSize: 8,
    items: [],
  });
});

describe("KnowledgeCenterLoader", () => {
  it("waits for a complete session before reading Knowledge", async () => {
    useSession.mockReturnValue({ ...completeSession, hydrated: false });
    const view = render(<KnowledgeCenterLoader />);

    await waitFor(() =>
      expect(getKnowledgePermission).not.toHaveBeenCalled(),
    );
    expect(getKnowledgeSummary).not.toHaveBeenCalled();
    expect(listKnowledge).not.toHaveBeenCalled();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("loads permission, summary and scoped list in parallel", async () => {
    render(<KnowledgeCenterLoader />);

    expect(
      await screen.findByRole("heading", { name: "知识库" }),
    ).toBeVisible();
    const scope = {
      organizationId: "org-guangwei",
      workspaceId: "ws-ai",
    };
    const actor = { userId: "user-lead" };
    expect(getKnowledgePermission).toHaveBeenCalledWith(scope, actor);
    expect(getKnowledgeSummary).toHaveBeenCalledWith(scope, actor);
    expect(listKnowledge).toHaveBeenCalledWith(
      scope,
      actor,
      expect.objectContaining({ page: 1, pageSize: 8 }),
    );
    expect(
      screen.getByRole("link", { name: "新增 / 导入知识" }),
    ).toBeVisible();
    expect(screen.getByRole("group", { name: "可见知识" })).toHaveTextContent(
      "4",
    );
  });

  it("keeps read access but hides management action for Auditor", async () => {
    useSession.mockReturnValue({
      ...completeSession,
      user: { id: "user-auditor", name: "赵岚", role: "Auditor" },
    });
    getKnowledgePermission.mockResolvedValue({
      canRead: true,
      canManage: false,
      canSubmitCorrection: false,
      reason: "Auditor read only.",
    });

    render(<KnowledgeCenterLoader />);

    expect(
      await screen.findByRole("heading", { name: "知识库" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "新增 / 导入知识" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("当前身份仅可查看和使用已授权的知识。"),
    ).toBeVisible();
  });
});
