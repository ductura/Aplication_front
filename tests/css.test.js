import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { checkModuleCss } from "../scripts/checks/css.mjs";

// Ductus DESIGN-SYSTEM.md §3 (commit 078c780f), D-188: dark graphite shell and near-white sheet.
const shell = {
  "--ground": "#242422", "--chrome": "#292a28", "--ink": "#faf9f5", "--ink-2": "#dedbd3", "--ink-3": "#c9c5bb",
  "--rule": "#8c887f", "--hover": "#3a3a36", "--accent": "#c8aa6e", "--radius-control": "5px", "--radius": "6px",
  "--focus-width": "3px", "--focus-offset": "4px",
  "--ff-ui": '"Instrument Sans", system-ui, sans-serif', "--ff-display": '"Newsreader", Georgia, serif',
};
// White sheet column of §3; --hover and --error (· there) take the light-shell value, because the
// sheet sits on the dark shell and the dark-shell values are unreadable on paper.
const whiteSheet = {
  "--sheet": "#fcfbf8", "--ink": "#242422", "--ink-2": "#55534d", "--ink-3": "#5c5a54", "--rule": "#cfccc4",
  "--well": "#efede7", "--hover": "#ecebe5", "--accent": "#806529",
  "--accent-hover": "#6b5420", "--accent-ink": "#fcfbf8", "--field": "#fcfbf8", "--field-rule": "#85827a",
  "--error": "#9c3f33",
};
const tokens = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  const body = start < 0 ? "" : css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};

it("globals.css carries exactly the D-188 values per scope", () => {
  const css = readFileSync("app/globals.css", "utf8");
  expect(tokens(css, ":root")).toEqual(shell);
  expect(tokens(css, '.sheet[data-sheet-theme="light"]')).toEqual(whiteSheet);
  expect(css.match(/^\s*--[\w-]+:/gm)).toHaveLength(Object.keys(shell).length + Object.keys(whiteSheet).length);
});

it.each([
  [".a { color: #abc; }"], [".a { color: #00000080; }"], [".a { background: rgb(0 0 0); }"], [".a { color: navy; }"],
  [".a { color: hsla(0, 0%, 0%, 1); }"], [".a { color: oklch(0.5 0 0); }"], [".a { color: CanvasText; }"],
  [".a { color: color-mix(in srgb, var(--ink), var(--accent)); }"], [".a { border: 1px solid red; }"],
  [".a { border-radius : 8px; }"], [".a { border-top-left-radius: 8px; }"], [".a { border-radius: 999px 2px; }"],
  [".a { border-radius: var(--x, 12px); }"], [".a { outline: 2px solid var(--accent); }"], [".a { outline-offset: 2px; }"],
  [".a { outline: 0.2rem solid var(--accent); }"], [".a { outline-width: thick; }"], [".a:focus-visible { outline: none; }"], [".a { outline: 0; }"],
  ['.a::after { content: "Spremljeno"; }'], [".a::after { content: attr(data-x); }"], [".a { --x: red; }"],
])("CSS module check rejects %s", (css) => expect(checkModuleCss(css)).not.toEqual([]));

it("CSS module check accepts tokens and ignores selectors; every real module is token-only", () => {
  expect(checkModuleCss(".outline:hover { border: 1px solid var(--rule); border-radius: var(--radius); }")).toEqual([]);
  expect(checkModuleCss(".a { background-size: cover; border-collapse: collapse; text-decoration: underline; content: ''; }")).toEqual([]);
  const plain = ["app", "src"].flatMap((d) => readdirSync(d, { recursive: true }).map((f) => `${d}/${f}`));
  expect(plain.filter((f) => f.endsWith(".css") && !f.endsWith(".module.css"))).toEqual(["app/globals.css"]);
  const mods = ["app", "src"].flatMap((d) =>
    readdirSync(d, { recursive: true }).filter((f) => f.endsWith(".module.css")).map((f) => `${d}/${f}`));
  expect(mods).not.toEqual([]);
  for (const f of mods) expect(checkModuleCss(readFileSync(f, "utf8")), f).toEqual([]);
});
