import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import RootLayout, { metadata } from "../app/layout.jsx";
import Page from "../app/page.jsx";
import { hr } from "../src/i18n/hr.js";

it("renders Croatian html with catalogue metadata", () => {
  expect(renderToStaticMarkup(<RootLayout><p /></RootLayout>)).toMatch(/^<html lang="hr"/);
  expect(metadata.title).toBe(hr.app.name);
});

it("home page shows the product name and a near-white sheet", () => {
  const html = renderToStaticMarkup(<Page />);
  expect(html).toContain(hr.app.name);
  expect(html).toMatch(/data-sheet-theme="light"/);
});

it("repository has no TypeScript", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
  expect(files.split("\n").filter((f) => /\.(ts|tsx|mts|cts)$|(^|\/)tsconfig[^/]*\.json$/.test(f))).toEqual([]);
});
