import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import RootLayout, { metadata } from "../app/layout.jsx";
import GlobalError from "../app/global-error.jsx";
import NotFound from "../app/not-found.jsx";
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

it("404 page uses catalogue text and links home", () => {
  const html = renderToStaticMarkup(<NotFound />);
  expect(html).toContain(hr.notFound.heading);
  expect(html).toMatch(new RegExp(`<a href="/"[^>]*>${hr.notFound.back}</a>`));
});

it("global error page is Croatian, from the catalogue and hides error details", () => {
  const html = renderToStaticMarkup(<GlobalError error={new Error("tajni detalj")} retry={() => {}} />);
  expect(html).toMatch(/^<html lang="hr"/);
  expect(html).toContain(hr.error.heading);
  expect(html).toContain(hr.error.retry);
  expect(html).not.toContain("tajni detalj");
});
