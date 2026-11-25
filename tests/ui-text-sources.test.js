import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// UI text reaches the page only through files the checks read: scripts under the lint rule
// (eslint.config.mjs) and CSS under the content rule below. Any other entry under app/, src/ or public/
// fails here until someone decides how it is checked. Nothing is skipped: dot directories,
// node_modules, ignored files and links are listed too; a link is neither a file nor a directory, so it fails.
const READ = /\.(js|jsx|mjs|css)$/;
const BINARY = /\.(png|ico|jpe?g|webp|avif|gif|woff2?)$/;
const list = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }) : [])
  .map((e) => ({ path: `${e.parentPath}/${e.name}`.replaceAll("\\", "/"), file: e.isFile(), dir: e.isDirectory() }));
const rejected = (entries, ok) => entries.filter((e) => !e.dir && !(e.file && ok.test(e.path))).map((e) => e.path);
const declarations = (css, prop) =>
  [...css.matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, "gi"))].map((m) => m[1].trim());

describe("UI text sources", () => {
  it("app/ and src/ hold only scripts the lint rule reads and CSS; public/ holds only binary assets", () => {
    expect(list("app").length).toBeGreaterThan(0);
    expect(rejected(list("app"), READ)).toEqual([]);
    expect(rejected(list("src"), READ)).toEqual([]);
    expect(rejected(list("public"), BINARY)).toEqual([]);
  });

  it("rejects every other kind of entry", () => {
    const f = (path) => ({ path, file: true, dir: false });
    const entries = [
      f("app/a.tsx"), f("app/a.ts"), f("src/a.cjs"), f("src/a.mts"), f("src/a.json"), f("app/icon.svg"), f("app/a.md"),
      f("app/manifest.webmanifest"), f("src/node_modules/x/index.d.ts"), f("app/.x/a.html"), f("src/a.jsx.txt"),
      { path: "src/link", file: false, dir: false },
    ];
    expect(rejected(entries, READ)).toEqual(entries.map((e) => e.path));
    expect(rejected([f("app/page.jsx"), f("src/a.mjs"), f("app/globals.css"), { path: "app/x", file: false, dir: true }], READ)).toEqual([]);
    expect(rejected([f("public/site.webmanifest"), f("public/a.svg"), f("public/robots.txt")], BINARY)).toHaveLength(3);
  });

  it("the repository has no script files the lint rule does not read", () => {
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
    expect(files.split("\n").filter((f) => /\.(cjs|cts|mts|ts|tsx)$/.test(f))).toEqual([]);
  });

  it("no CSS file under app/ or src/ writes text through content", () => {
    expect(declarations('.a::after{content:"x"} .b{ content : attr(data-x) ;}', "content")).toEqual(['"x"', "attr(data-x)"]);
    expect(declarations(".a{--content: 1; background-content: 2}", "content")).toEqual([]);
    const css = [...list("app"), ...list("src")].filter((e) => e.file && e.path.endsWith(".css")).map((e) => e.path);
    expect(css).toContain("app/globals.css");
    for (const f of css) {
      for (const v of declarations(readFileSync(f, "utf8"), "content")) expect(v, f).toMatch(/^(""|''|none)$/);
    }
  });
});
