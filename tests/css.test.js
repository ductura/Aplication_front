import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

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

it("CSS modules take colours only from tokens and never write the focus ring themselves", () => {
  for (const f of ["app/page.module.css", "src/components/ui.module.css"]) {
    const css = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi), f).toBeNull();
    expect(css, f).not.toMatch(/outline/);
  }
});
