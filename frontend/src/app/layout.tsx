import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIOS",
  description: "企业 AI 工作操作系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="antialiased">{children}</body>
    </html>
  );
}
