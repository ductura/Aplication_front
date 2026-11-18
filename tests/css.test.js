import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// DESIGN-SYSTEM.md §3 (Ductus 078c780f), D-188: dark graphite shell and near-white sheet.
const shell = {
  "--ground": "#242422", "--chrome": "#292a28", "--ink": "#faf9f5", "--ink-2": "#dedbd3",
  "--rule": "#8c887f", "--accent": "#c8aa6e", "--accent-ink": "#242422",
  "--radius": "6px", "--focus-width": "3px", "--focus-offset": "4px",
};
const whiteSheet = {
  "--sheet": "#fcfbf8", "--ink": "#242422", "--ink-2": "#55534d", "--rule": "#cfccc4",
  "--accent": "#806529", "--accent-ink": "#fcfbf8",
};
const tokens = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  const body = start < 0 ? "" : css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
const banned = [
  /#[0-9a-f]{3,8}\b/i, /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i,
  /:\s*(white|black|red|green|blue|gray|grey|gold|yellow|orange|silver)\b/i,
  /outline(-width|-offset)?:[^;]*\d+px/i, /border-radius:(?!\s*(999px|50%|var\())/i, /content:\s*["'][^"']*\p{L}/iu,
];
const check = (css) => banned.filter((re) => re.test(css));

describe("design tokens and CSS modules", () => {
  it.each([
    ["hex", ".a { color: #abc; }"], ["8-digit hex", ".a { color: #00000080; }"], ["rgb", ".a { background: rgb(0 0 0); }"],
    ["hsla", ".a { color: hsla(0, 0%, 0%, 1); }"], ["oklch", ".a { color: oklch(0.5 0 0); }"],
    ["color-mix", ".a { color: color-mix(in srgb, var(--ink), var(--accent)); }"], ["named", ".a { color: white; }"],
    ["hard focus", ".a:focus-visible { outline: 2px solid var(--accent); }"], ["hard offset", ".a { outline-offset: 2px; }"],
    ["hard radius", ".a { border-radius: 8px; }"], ["text in content", '.a::after { content: "Spremljeno"; }'],
  ])("rejects %s in a module", (_, css) => {
    expect(check(css)).not.toEqual([]);
  });

  it("accepts token-only CSS", () => {
    expect(check(".a { color: var(--ink); border-radius: var(--radius); outline: var(--focus-width) solid var(--accent); }")).toEqual([]);
  });

  it("globals.css carries the D-188 values per scope", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(tokens(css, ":root")).toMatchObject(shell);
    expect(tokens(css, '.sheet[data-sheet-theme="light"]')).toMatchObject(whiteSheet);
  });

  it("every real CSS module is token-only", () => {
    const mods = readdirSync("app", { recursive: true }).filter((f) => f.endsWith(".module.css"));
    expect(mods).not.toEqual([]);
    for (const f of mods) expect(check(readFileSync(`app/${f}`, "utf8")), f).toEqual([]);
  });
});
