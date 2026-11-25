import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { posix } from "node:path";
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
// Comments are removed first: one between a property and its colon would hide the declaration,
// and a declaration written inside a comment is not one.
const declarations = (css, prop) =>
  [...css.replace(/\/\*[\s\S]*?(\*\/|$)/g, " ").matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, "gi"))].map((m) => m[1].trim());

// CSS can put text on the page through content, quotes, list markers and @counter-style, or pull it in
// through url(). So: no escapes, no url(), only the at-rules below, content only "", '' or none, and a
// non-empty string only in a selector or as a font-family / --ff-* value.
const AT_RULES = ["media", "supports", "keyframes", "layer", "container"];
const cssProblems = (raw) => {
  const out = [];
  if (raw.includes("\\")) out.push("escape");
  const css = raw.replace(/\/\*[\s\S]*?(\*\/|$)/g, " ");
  if (/url\(|data:/i.test(css)) out.push("url");
  for (const m of css.matchAll(/@([\w-]+)/g)) if (!AT_RULES.includes(m[1].toLowerCase())) out.push(`@${m[1]}`);
  for (const m of css.matchAll(/"[^"]*"|'[^']*'/g)) {
    if (m[0].length === 2) continue;
    const after = css.slice(m.index + m[0].length);
    if (after[after.search(/[;{}]/)] === "{") continue;
    const before = css.slice(0, m.index);
    const start = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}")) + 1;
    const prop = before.slice(start).split(":")[0].trim().toLowerCase();
    if (prop !== "font-family" && !prop.startsWith("--ff-")) out.push(`${prop}: ${m[0]}`);
  }
  for (const v of declarations(raw, "content")) if (!/^(""|''|none)$/.test(v)) out.push(`content: ${v}`);
  return out;
};

// Scripts under app/ and src/ import only from app/ and src/ (files the checks read) or from these packages;
// a JSON file, fs or a computed specifier would bring text past the lint rule.
const PACKAGES = /^(react|react-dom|next)(\/[\w/-]+)?$/;
const importProblems = (file, text) => {
  const out = [];
  if (/\b(import|require)\s*\(\s*(?!(["'])[^"'`$]*\2\s*\))/.test(text)) out.push("computed specifier");
  for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'`])([^"'`]*)\1/g)) {
    const spec = m[2];
    if (!spec.startsWith(".")) {
      if (!PACKAGES.test(spec)) out.push(spec);
      continue;
    }
    const target = posix.normalize(posix.join(posix.dirname(file), spec));
    if (!/^(app|src)\//.test(target) || !READ.test(target)) out.push(spec);
  }
  return out;
};

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

  it("no CSS file under app/ or src/ writes text", () => {
    expect(declarations('.a::after{content:"x"} .b{ content : attr(data-x) ;}', "content")).toEqual(['"x"', "attr(data-x)"]);
    expect(declarations(".a{--content: 1; background-content: 2}", "content")).toEqual([]);
    expect(declarations('.a::after{content/**/: "x"} .b{content/* a\n b */:"y"}', "content")).toEqual(['"x"', '"y"']);
    expect(declarations('/* content: "x" */ .a{color:red} /* .b{content:"y"}', "content")).toEqual([]);
    const bad = [
      '.x::after{/**/content:"x"}', '.x::after { color: inherit;/* sep */content: "x"; }', '.x::after { \\63 ontent: "x"; }',
      '.x::after{CONTENT:"x"}', ".x::after{content:attr(title)}", '.x{quotes:"x" ""} .x::before{content:open-quote}',
      '.x{list-style-type:"x "}', '@counter-style r{symbols:"x"} .x{list-style:r}', ".x{list-style-image:url(a.png)}",
      '.x{background:url("data:image/svg+xml,x")}', '@import "a.css";', '@font-face{font-family:"x"}', ".x{--t:'x'}",
    ];
    for (const css of bad) expect(cssProblems(css), css).not.toEqual([]);
    const good = [
      '.a::after{content:""} .b::before{content:none}', ':root{--ff-ui:"Instrument Sans", system-ui}',
      '.a{font-family:"Inter", sans-serif}', '[data-x="y"] .a{color:red}', "@media (max-width: 640px){.a{color:red}}",
      '/* .b{content:"y"} */ .a{color:red}',
    ];
    for (const css of good) expect(cssProblems(css), css).toEqual([]);

    const css = [...list("app"), ...list("src")].filter((e) => e.file && e.path.endsWith(".css")).map((e) => e.path);
    expect(css).toContain("app/globals.css");
    for (const f of css) expect(cssProblems(readFileSync(f, "utf8")), f).toEqual([]);
  });

  it("scripts under app/ and src/ import only from app/, src/ and the allowed packages", () => {
    const bad = [
      'import p from "../poruke.json";', 'import p from "../../poruke.json" with { type: "json" };', 'import p from "./a.json";',
      'import { readFileSync } from "node:fs";', 'import fs from "fs";', 'const p = require("../poruke.json");',
      "const p = await import(name);", "const p = await import(`./${n}.js`);", 'import x from "../scripts/a.mjs";',
      'export * from "../lib/a.js";', 'import x from "lodash";',
    ];
    for (const s of bad) expect(importProblems("app/page.jsx", s), s).not.toEqual([]);
    const good = [
      'import { hr } from "../src/i18n/hr.js";', 'import s from "./page.module.css";', 'import Link from "next/link";',
      'import { useState } from "react";', 'const P = await import("../src/components/Traka.jsx");',
    ];
    for (const s of good) expect(importProblems("app/page.jsx", s), s).toEqual([]);

    const scripts = [...list("app"), ...list("src")].filter((e) => e.file && /\.(js|jsx|mjs)$/.test(e.path));
    expect(scripts.length).toBeGreaterThan(0);
    for (const { path } of scripts) expect(importProblems(path, readFileSync(path, "utf8")), path).toEqual([]);
  });
});
