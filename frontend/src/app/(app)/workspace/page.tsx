export default function WorkspacePage() {
  return (
    <section aria-labelledby="workspace-title">
      <p className="text-sm font-medium text-[var(--aios-primary)]">Workspace</p>
      <h1 id="workspace-title" className="mt-2 text-3xl font-semibold tracking-tight">
        工作台
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--aios-muted)]">
        当前已进入受 Organization、Workspace 与用户身份约束的工作范围。工作指标与
        AI 研发员工任务视图将在下一实施阶段接入。
      </p>
    </section>
  );
}
