import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("renders the AIOS entry heading and login link", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { name: "企业 AI 工作操作系统" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "进入 AIOS" })).toHaveAttribute(
    "href",
    "/login",
  );
});
