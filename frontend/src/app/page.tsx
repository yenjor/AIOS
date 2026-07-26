import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-6 py-16 text-slate-950">
      <section className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
        <p className="text-sm font-semibold tracking-[0.2em] text-indigo-600">
          AIOS
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          企业 AI 工作操作系统
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          统一管理企业知识库、Capability、Agent、Task、Tool、Artifact 与
          Audit，让 AI 员工在明确责任和权限边界内完成工作。
        </p>
        <Link
          className="mt-8 inline-flex items-center rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          href="/login"
        >
          进入 AIOS
        </Link>
      </section>
    </main>
  );
}
