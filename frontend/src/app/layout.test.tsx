import { expect, test, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

import RootLayout, { metadata } from "./layout";

test("provides Chinese document metadata and language", () => {
  const layout = RootLayout({ children: <div /> });

  expect(layout.props.lang).toBe("zh-CN");
  expect(metadata.title).toBe("AIOS");
  expect(metadata.description).toBe("企业 AI 工作操作系统");
});
