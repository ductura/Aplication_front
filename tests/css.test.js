import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Ductus DESIGN-SYSTEM.md §3 (commit 078c780f), D-188: dark graphite shell and near-white sheet.
const shell = {
  "--ground": "#242422", "--chrome": "#292a28", "--ink": "#faf9f5", "--ink-2": "#dedbd3", "--rule": "#8c887f",
  "--accent": "#c8aa6e", "--radius": "6px", "--focus-width": "3px", "--focus-offset": "4px",
  "--ff-ui": '"Instrument Sans", system-ui, sans-serif', "--ff-display": '"Newsreader", Georgia, serif',
};
const whiteSheet = { "--sheet": "#fcfbf8", "--ink": "#242422", "--ink-2": "#55534d", "--accent": "#806529" };
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
