import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { posix } from "node:path";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

// UI text reaches the page only through files the checks read: scripts under the lint rule
// (eslint.config.mjs) and CSS under the content rule below. Any other entry under app/, src/ or public/
// fails here until someone decides how it is checked. Nothing is skipped: ignored files and links are listed
// too (a link is neither a file nor a directory, so it fails), and node_modules or dot entries fail outright.
const READ = /\.(js|jsx|mjs|css)$/;
const BINARY = /\.(png|ico|jpe?g|webp|avif|gif|woff2?)$/;
const list = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }) : [])
  .map((e) => ({ path: `${e.parentPath}/${e.name}`.replaceAll("\\", "/"), file: e.isFile(), dir: e.isDirectory() }));
// node_modules and dot entries are skipped by ESLint and other tools, so none may exist under these roots.
const HIDDEN_DIR = /(^|\/)(node_modules|\.[^/]*)(\/|$)/;
const rejected = (entries, ok) =>
  entries.filter((e) => HIDDEN_DIR.test(e.path) || (!e.dir && !(e.file && ok.test(e.path)))).map((e) => e.path);
// Comments are removed first, outside strings only (a "/*" inside a string starts no comment): one between
// a property and its colon would hide the declaration, and a declaration inside a comment is not one.
const stripComments = (css) => {
  let out = "";
  for (let i = 0; i < css.length; ) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const end = css.indexOf(c, i + 1);
      const j = end === -1 ? css.length : end + 1;
      out += css.slice(i, j);
      i = j;
    } else if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      out += " ";
      i = end === -1 ? css.length : end + 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
};
// A declaration can follow ;, {, } (a nested block) or whitespace: the name is found wherever it is not part of
// a longer identifier, class or id.
const declarations = (css, prop) =>
  [...stripComments(css).matchAll(new RegExp(`(?<![-\\w.#])${prop}\\s*:\\s*([^;{}]+)`, "gi"))].map((m) => m[1].trim());

// CSS can put text on the page through content, quotes, list markers and @counter-style, or pull it in
// through url(). So: no escapes, no url(), only the at-rules below, content only "", '' or none, and a
// non-empty string only in a selector or as a font-family / --ff-* value.
const AT_RULES = ["media", "supports", "keyframes", "layer", "container"];
const cssProblems = (raw) => {
  const out = [];
  if (raw.includes("\\")) out.push("escape");
  const css = stripComments(raw);
  if (/url\(|data:/i.test(css)) out.push("url");
  // attr() writes an attribute's text in content and in other properties alike, so it is not used at all.
  if (/attr\s*\(/i.test(css)) out.push("attr()");
  // A string custom property (--ff-*) may be used only as a font; text-writing properties take no var().
  for (const m of css.matchAll(/(?<![-\w.#])([-\w]+)\s*:\s*([^;{}]*)(?=[;}]|$)/g)) {
    const prop = m[1].toLowerCase();
    const isFont = prop === "font-family" || prop === "font" || prop.startsWith("--ff-");
    if (/var\(\s*--ff-/i.test(m[2]) && !isFont) out.push(`${prop}: var(--ff-*)`);
    if (/^(content|quotes|list-style(-type)?|counter-(reset|set|increment))$/.test(prop) && /var\(/i.test(m[2])) out.push(`${prop}: var()`);
  }
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
// Specifiers are read from the syntax tree (ESLint's own parser), so a comment or line break between the
// keyword and the string cannot hide one.
const linter = new Linter();
const specifiers = (text) => {
  const found = [];
  const add = (node) => found.push(node?.type === "Literal" && typeof node.value === "string" ? node.value : null);
  const plugin = { rules: { s: { create: () => ({
    ImportDeclaration: (n) => add(n.source),
    ExportAllDeclaration: (n) => add(n.source),
    ExportNamedDeclaration: (n) => n.source && add(n.source),
    ImportExpression: (n) => add(n.source),
    CallExpression: (n) => n.callee.type === "Identifier" && n.callee.name === "require" && add(n.arguments[0]),
  }) } } };
  const messages = linter.verify(text, [{
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { x: plugin }, rules: { "x/s": "error" },
  }], { filename: "x.js" });
  return messages.some((m) => m.fatal) ? [null] : found;
};
const importProblems = (file, text) => {
  const out = [];
  const specs = specifiers(text);
  if (specs.includes(null)) out.push("computed specifier or unparsed file");
  // Modules and code reached without an import: process.* other than process.env.NAME, globalThis, eval, Function
  // and .constructor (the way to Function without naming it). This reads words, not meaning: it stops slips, not
  // a deliberately disguised name; review covers that.
  if (/\bprocess\b(?!\.env\.\w)/.test(text)) out.push("process");
  if (/\b(globalThis|eval|Function|getBuiltinModule|constructor)\b/.test(text)) out.push("global access");
  for (const spec of specs) {
    if (spec === null) continue;
    if (!spec.startsWith(".")) {
      if (!PACKAGES.test(spec)) out.push(spec);
      continue;
    }
    // A bundler reads ?query and #fragment (and may read other characters) where normalize sees path segments,
    // so a relative path holds only word characters, ".", "/", "-" and the [ ] of dynamic route segments.
    if (!/^\.{1,2}\/[\w./[\]-]+$/.test(spec)) {
      out.push(spec);
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
      { path: "src/link", file: false, dir: false }, f("app/node_modules/a.js"), f("src/.x/a.js"), f("app/.a.js"),
      { path: "app/node_modules", file: false, dir: true }, { path: "src/.x", file: false, dir: true },
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
    expect(declarations(".a{@media all{}content:attr(t)} .b{.c{}content:x}", "content")).toEqual(["attr(t)", "x"]);
    const bad = [
      '.x::after{/**/content:"x"}', '.x::after { color: inherit;/* sep */content: "x"; }', '.x::after { \\63 ontent: "x"; }',
      '.x::after{CONTENT:"x"}', ".x::after{content:attr(title)}", '.x{quotes:"x" ""} .x::before{content:open-quote}',
      '.x{list-style-type:"x "}', '@counter-style r{symbols:"x"} .x{list-style:r}', ".x{list-style-image:url(a.png)}",
      '.x{background:url("data:image/svg+xml,x")}', '@import "a.css";', '@font-face{font-family:"x"}', ".x{--t:'x'}",
      '.a{font-family:"/*"} .b::after{content:"x"} .c{font-family:"*/"}', ":root{--ff-q:\"x \"} .d{list-style-type:var(--ff-q)}",
      ':root{--ff-q:"x "} .e{quotes:var(--ff-q) var(--ff-q)}', ".f::after{content:var(--c)}", ".g{counter-reset:var(--c)}",
      ".h{grid-area:var(--ff-q)}", ".x::before{@media all{}content:attr(t)}", ':root{--ff-q:"x"} .x::before{.y{}content:var(--ff-q)}',
      "li{@media all{}list-style-type:var(--ff-q)}", ".x::before{}content:attr(t)", '.x{.y{}quotes:"x" "y"}',
      ".q{list-style-type:attr(data-q)}", "li{list-style:attr(data-q) inside}", "q{quotes:attr(data-a) attr(data-b)}",
      ".x{text-emphasis-style:attr(data-q)}", ".x{text-emphasis-style:'x'}",
    ];
    for (const css of bad) expect(cssProblems(css), css).not.toEqual([]);
    const good = [
      '.a::after{content:""} .b::before{content:none}', ':root{--ff-ui:"Instrument Sans", system-ui}',
      '.a{font-family:"Inter", sans-serif}', '[data-x="y"] .a{color:red}', "@media (max-width: 640px){.a{color:red}}",
      '/* .b{content:"y"} */ .a{color:red}', ".a{font-family:var(--ff-ui);color:var(--c)} .b:hover{color:red}",
      ".content:hover{color:red} #quotes:focus{color:red} .a{.b{}color:red}",
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
      'export * from "../lib/a.js";', 'import x from "lodash";', 'const fs = process.getBuiltinModule("node:fs");',
      'const fs = process["getBuiltinModule"]("fs");', "const b = process.binding;", 'const f = globalThis.process;',
      'eval("x");', 'new Function("return 1")();', "const e = process.env;",
      'const g = [].constructor.constructor("return this")();', 'const g = x["constructor"];',
      'import p from /* x */ "../../poruke.json";', 'import p from // x\n "../poruke.json";',
      'export * as p from /* */ "../poruke.json";', 'import /**/ "../a.css";', 'const p = require(/**/ "../a.json");',
      'const p = await import(/**/ "../a.json");', 'export { a } from /**/ "../a.js";', "import p from",
      'import p from "../poruke.json?/../app/x.js";', 'import p from "../poruke.json#/../app/x.js";',
      'import p from "./a.js?raw";', 'import p from "./a b.js";', 'import p from "..\\\\poruke.json";',
    ];
    for (const s of bad) expect(importProblems("app/page.jsx", s), s).not.toEqual([]);
    const good = [
      'import { hr } from "../src/i18n/hr.js";', 'import s from "./page.module.css";', 'import Link from "next/link";',
      'import { useState } from "react";', 'const P = await import("../src/components/Traka.jsx");',
      "const u = process.env.APLICATION_SERVER_URL;", 'import { hr } from /* catalogue */ "../src/i18n/hr.js";', 'export { GET } from "./[id]/route.js";',
      'const s = "from \\"../a.json\\""; const t = <p className="x">{s}</p>;',
    ];
    for (const s of good) expect(importProblems("app/page.jsx", s), s).toEqual([]);

    const scripts = [...list("app"), ...list("src")].filter((e) => e.file && /\.(js|jsx|mjs)$/.test(e.path));
    expect(scripts.length).toBeGreaterThan(0);
    for (const { path } of scripts) expect(importProblems(path, readFileSync(path, "utf8")), path).toEqual([]);
  });
});
