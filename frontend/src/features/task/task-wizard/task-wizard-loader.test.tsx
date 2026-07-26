import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskRepository } from "../mock/task-repository";
import { TaskWizardLoader } from "./task-wizard-loader";

const repository = vi.hoisted(() => ({
  getTaskPermission: vi.fn<TaskRepository["getTaskPermission"]>(),
  getDraft: vi.fn<TaskRepository["getDraft"]>(),
  saveDraft: vi.fn<TaskRepository["saveDraft"]>(),
  discardDraft: vi.fn<TaskRepository["discardDraft"]>(),
  submitTechnicalSolutionTask:
    vi.fn<TaskRepository["submitTechnicalSolutionTask"]>(),
}));
const { useSession, push } = vi.hoisted(() => ({
  useSession: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/session/session-provider", () => ({ useSession }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../mock/task-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../mock/task-repository")>()),
  ...repository,
}));

const session = {
  hydrated: true,
  user: { id: "user-pm", name: "林悦", role: "产品经理" },
  organization: { id: "org-guangwei", name: "光位科技" },
  workspace: {
    id: "ws-ai",
    organizationId: "org-guangwei",
    name: "AI 智能业务线",
  },
};

beforeEach(() => {
  Object.values(repository).forEach((mock) => mock.mockReset());
  useSession.mockReset();
  push.mockReset();
  repository.getTaskPermission.mockResolvedValue({
    allowed: true,
    code: "ALLOWED",
    reason: "allowed",
  });
  repository.getDraft.mockResolvedValue(undefined);
  repository.saveDraft.mockImplementation(
    async (_scope, _actor, draft) => draft,
  );
});

describe("TaskWizardLoader", () => {
  it.each([
    ["unhydrated", { ...session, hydrated: false }],
    ["no user", { ...session, user: undefined }],
    ["no organization", { ...session, organization: undefined }],
    ["no workspace", { ...session, workspace: undefined }],
  ])("does not touch the repository while %s", async (_label, value) => {
    useSession.mockReturnValue(value);
    const view = render(<TaskWizardLoader />);

    await waitFor(() =>
      expect(repository.getTaskPermission).not.toHaveBeenCalled(),
    );
    expect(repository.getDraft).not.toHaveBeenCalled();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("checks permission before loading a draft and denies an Auditor safely", async () => {
    useSession.mockReturnValue({
      ...session,
      user: { id: "user-auditor", name: "赵岚", role: "Auditor" },
    });
    repository.getTaskPermission.mockResolvedValue({
      allowed: false,
      code: "FORBIDDEN",
      reason: "Auditor has read-only Task access.",
    });

    render(<TaskWizardLoader />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "当前身份不能创建 Task",
    );
    expect(repository.getDraft).not.toHaveBeenCalled();
  });

  it("passes the active scope and stable actor to the permission and draft calls", async () => {
    useSession.mockReturnValue(session);
    render(<TaskWizardLoader />);

    await screen.findByRole("heading", { name: "创建 Task" });
    const scope = {
      organizationId: "org-guangwei",
      workspaceId: "ws-ai",
    };
    expect(repository.getTaskPermission).toHaveBeenCalledWith(scope, {
      userId: "user-pm",
    });
    expect(repository.getDraft).toHaveBeenCalledWith(scope, {
      userId: "user-pm",
    });
  });

  it("ignores stale permission results after the active actor changes", async () => {
    let resolveOld!: (value: {
      allowed: boolean;
      code: "ALLOWED";
      reason: string;
    }) => void;
    repository.getTaskPermission
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce({
        allowed: false,
        code: "FORBIDDEN",
        reason: "read only",
      });
    useSession.mockReturnValue(session);
    const view = render(<TaskWizardLoader />);

    useSession.mockReturnValue({
      ...session,
      user: { id: "user-auditor", name: "赵岚", role: "Auditor" },
    });
    view.rerender(<TaskWizardLoader />);
    resolveOld({ allowed: true, code: "ALLOWED", reason: "old" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "当前身份不能创建 Task",
    );
    expect(repository.getDraft).not.toHaveBeenCalled();
  });

  it("does not continue into draft loading after unmount", async () => {
    let resolvePermission!: (value: {
      allowed: boolean;
      code: "ALLOWED";
      reason: string;
    }) => void;
    repository.getTaskPermission.mockReturnValue(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );
    useSession.mockReturnValue(session);
    const view = render(<TaskWizardLoader />);

    view.unmount();
    resolvePermission({ allowed: true, code: "ALLOWED", reason: "late" });

    await waitFor(() => expect(repository.getDraft).not.toHaveBeenCalled());
  });

  it("shows all templates, five steps and an accessible current step", async () => {
    useSession.mockReturnValue(session);
    const interaction = userEvent.setup();
    render(<TaskWizardLoader />);

    await screen.findByRole("heading", { name: "创建 Task" });
    for (const template of [
      "理解代码",
      "分析需求",
      "生成技术方案",
      "辅助编码",
      "Code Review",
      "自动测试",
    ]) {
      expect(screen.getByRole("radio", { name: new RegExp(template) })).toBeVisible();
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    const firstStep = screen.getByRole("button", {
      name: "第 1 步：选择模板",
    });
    const secondStep = screen.getByRole("button", {
      name: "第 2 步：定义工作",
    });
    expect(firstStep).toHaveAttribute("aria-current", "step");
    expect(secondStep).toBeDisabled();

    await interaction.click(
      screen.getByRole("radio", { name: /生成技术方案/ }),
    );
    await interaction.click(screen.getByRole("button", { name: "下一步" }));
    expect(secondStep).toHaveAttribute("aria-current", "step");
    expect(firstStep).toBeEnabled();
  });
});
