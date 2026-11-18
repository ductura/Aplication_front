import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();
const errors = async (code) =>
  (await eslint.lintText(code, { filePath: "app/fixture.jsx" }))[0].messages
    .filter((m) => m.severity === 2)
    .map((m) => m.ruleId);

describe("UI text must come from the catalogue (real eslint.config.mjs)", () => {
  it.each([
    ["JSX text", "<h1>Ductura</h1>", "react/jsx-no-literals"],
    ["string in braces", '<h1>{"Ductura"}</h1>', "react/jsx-no-literals"],
    ["ternary text", '<p>{x ? "Da" : "Ne"}</p>', "no-restricted-syntax"],
    ["logical text", '<p>{x && "Da"}</p>', "no-restricted-syntax"],
    ["aria-label", '<button aria-label="Dodaj" />', "no-restricted-syntax"],
    ["aria-label in braces", '<button aria-label={"Dodaj"} />', "no-restricted-syntax"],
    ["template title", "<p title={`Naslov`} />", "no-restricted-syntax"],
    ["ternary placeholder", '<input placeholder={x ? "Broj" : ""} />', "no-restricted-syntax"],
    ["alt", '<img alt="Znak" src="/a.png" />', "no-restricted-syntax"],
    ["label prop", '<Field label="Broj" />', "no-restricted-syntax"],
  ])("fails on %s", async (_, jsx, rule) => {
    expect(await errors(`const x = 1;\nconst Field = () => null;\nexport const A = () => ${jsx};\n`)).toContain(rule);
  });

  it("catalogue text, lang and className pass", async () => {
    const code = 'import { hr } from "../src/i18n/hr.js";\nexport const A = () => <html lang="hr" className="a"><h1 title={hr.app.name}>{hr.app.name}</h1></html>;\n';
    expect(await errors(code)).toEqual([]);
  });
});
