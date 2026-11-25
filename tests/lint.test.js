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

describe("text with letters in app/ and src/ outside src/i18n is a technical token or nothing", () => {
  const ui = async (code, filePath = "app/fixture.jsx") =>
    (await eslint.lintText(code, { filePath }))[0].messages
      .filter((m) => m.ruleId === "ui-text/literal-text")
      .map((m) => m.messageId);

  it.each([
    ["own component prop", 'const F = () => null;\nexport const A = () => <F naslov="Dodaj instituciju" />;\n'],
    ["own component prop, lower case", 'const F = () => null;\nexport const A = () => <F naslov="dodaj" />;\n'],
    ["constant shown as {label}", 'const label = "Dodaj instituciju";\nexport const A = () => <p>{label}</p>;\n'],
    ["object", 'export const t = { naslov: "Dodaj" };\n'],
    ["spread", 'export const A = () => <button {...{ "aria-label": "Dodaj" }} />;\n'],
    ["concatenation", 'export const a = "dodaj" + " instituciju";\n'],
    ["join", 'export const a = ["dodaj", "instituciju"].join(" ");\n'],
    ["template", "export const a = (x) => `${x} dodaj instituciju`;\n"],
    ["function argument", 'export const a = (f) => f("Institucija je dodana");\n'],
  ])("fails on %s", async (_, code) => {
    expect(await ui(code)).toContain("literal");
  });

  it("fails on text in a module outside src/i18n", async () => {
    expect(await ui('export const poruka = "Institucija je dodana";\n', "src/lib/fixture.js")).toContain("literal");
  });

  it("reads technical places too: hidden characters fail", async () => {
    expect(await ui('export const A = () => <p className={"a\\u200bb"} />;\n')).toContain("text");
    expect(await ui('export const a = "a" + "\\u00ad" + "b";\n')).toContain("text");
    for (const c of ["\\u0000", "\\b", "\\u001b", "\\u007f", "\\u0085"]) expect(await ui(`export const a = "${c}";\n`)).toContain("text");
  });

  it("reads static parts of templates and + chains as written together", async () => {
    expect(await ui('export const a = `sum${"n"}jivo`;\n')).toContain("text");
    expect(await ui('export const a = (x) => "sum" + "njivo" + x;\n')).toContain("text");
    expect(await ui('export const a = (x) => x + "sum" + "njivo";\n')).toContain("text");
    expect(await ui('export const a = (x) => `${x}dodaj${" "}instituciju`;\n')).toContain("literal");
  });

  it("technical tokens, technical attributes and src/i18n pass", async () => {
    const code = `"use client";\nimport Link from "next/link";\nconst ALLOW = "POST";
export async function f(s, id) {
  if (s === "nedostupan") return "nema";
  const r = await fetch(\`/api/v1/institucije/\${id}\`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "Cache-Control": "no-store" } });
  return r.ok ? { greska: "zauzeto" } : ALLOW;
}
export const A = ({ id }) => <table className={\`sheet \${id}\`}><thead><tr><th scope="col" key="a">{id}</th></tr></thead>
<tbody><tr><td><Link href="/x" rel="noreferrer" target="_blank" className="a b">{id}</Link></td></tr></tbody></table>;\n`;
    expect(await ui(code)).toEqual([]);
    expect(await ui('export const hr = { a: "Dodaj instituciju" };\n', "src/i18n/fixture.js")).toEqual([]);
  });
});
