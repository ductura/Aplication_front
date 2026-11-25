import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();
const ruleIds = async (code, filePath = "app/fixture.jsx") =>
  (await eslint.lintText(code, { filePath }))[0].messages.filter((m) => m.severity === 2).map((m) => m.ruleId);
const component = (jsx) => `const x = 1;\nconst Field = () => null;\nexport const A = () => ${jsx};\n`;
const TEXT = "no-restricted-syntax";

describe("UI text must come from the catalogue (real eslint.config.mjs)", () => {
  it.each([
    ["<h1>Ductura</h1>", "react/jsx-no-literals"], ['<h1>{"Ductura"}</h1>', "react/jsx-no-literals"],
    ['<p>{x ? "Da" : "Ne"}</p>', TEXT], ['<p>{x && "Da"}</p>', TEXT], ['<p>{["Da"]}</p>', TEXT],
    ['<p>{String("Da")}</p>', TEXT], ['<p>{"Da".trim()}</p>', TEXT], ['<p>{(x, "Da")}</p>', TEXT],
    ["<p>{String.raw`Da`}</p>", TEXT], ['<>{x ? "Da" : null}</>', TEXT],
    ['<button aria-label="Dodaj" />', TEXT], ['<button aria-label={"Dodaj"} />', TEXT],
    ['<p aria-description="Opis" />', TEXT], ['<p aria-roledescription="Kartica" />', TEXT],
    ['<p aria-valuetext="Pola" />', TEXT], ['<p aria-placeholder="Broj" />', TEXT], ["<p title={`Naslov`} />", TEXT],
    ['<input placeholder={x ? "Broj" : ""} />', TEXT], ['<img alt="Znak" src="/a.png" />', TEXT],
    ['<Field label="Broj" />', TEXT], ['<input value="Pošalji" readOnly />', TEXT], ['<input defaultValue="Broj" />', TEXT],
    ["<p dangerouslySetInnerHTML={{ __html: x }} />", "react/no-danger"],
    ['<Field label={<p>{x ? "Da" : "Ne"}</p>} />', TEXT], ['<Field render={() => <p>{"Da".trim()}</p>} />', TEXT],
  ])("fails on %s", async (jsx, rule) => {
    expect(await ruleIds(component(jsx))).toContain(rule);
    // The first case loads the real eslint.config.mjs cold (17-31 s on a Windows machine).
  }, 60_000);

  it("fails on literal text in a .mjs component and ignores eslint-disable comments", async () => {
    expect(await ruleIds(component("<p>Sumnjivo</p>"), "app/bad.mjs")).toContain("react/jsx-no-literals");
    expect(await ruleIds(`/* eslint-disable */\n${component("<p>Da</p>")}`)).toContain("react/jsx-no-literals");
  });

  it("fails on literal metadata text; the repository has no .cjs files", async () => {
    expect(await ruleIds('export const metadata = { title: "Ductura" };\n')).toContain(TEXT);
    expect(await ruleIds('export function generateMetadata() { return { title: `Ductura` }; }\n')).toContain(TEXT);
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
    expect(files.split("\n").filter((f) => f.endsWith(".cjs"))).toEqual([]);
  });

  it("catalogue text, lang, className, key and href pass", async () => {
    const code = `import Link from "next/link";\nimport { hr } from "../src/i18n/hr.js";\nconst rows = [{ id: 1 }];
export const A = () => <html lang="hr" className="a"><h1 title={hr.app.name}>{hr.app.name}</h1>
{rows.map((r) => <Link key={r.id} className="b" href="/">{hr.home.heading}</Link>)}</html>;\n`;
    expect(await ruleIds(code)).toEqual([]);
  });
});
