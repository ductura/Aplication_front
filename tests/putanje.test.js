// Address map D-318 (DAN-1574): administration lives under /administracija,
// and login and logout land on /administracija/prijava. Old /admin addresses
// are redirected (301) by the edge, so nothing in this app may point there.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Nedostupno from "../src/components/Nedostupno.jsx";
import { api, BASE_PATH } from "../src/lib/putanje.js";

const datoteke = (dir) =>
  readdirSync(dir).flatMap((ime) => {
    const p = join(dir, ime);
    return statSync(p).isDirectory() ? datoteke(p) : /\.(js|jsx|mjs)$/.test(ime) ? [p] : [];
  });

// A string or template literal that starts with /admin as a path segment
// (/admin, /admin/..., /admin?...). Server routes /api/admin/... do not match.
const STARA_ADRESA = /["'`]\/admin(?=[/"'`?#]|$)/m;

describe("address map D-318", () => {
  it("serves the app under /administracija", () => {
    expect(BASE_PATH).toBe("/administracija");
    expect(readFileSync("next.config.mjs", "utf8")).toMatch(/basePath:\s*BASE_PATH\b/);
  });

  it("sends browser BFF calls under the new base path", () => {
    expect(api("/prijava")).toBe("/administracija/api/v1/prijava");
    expect(api("/odjava")).toBe("/administracija/api/v1/odjava");
    expect(api("/institucije/x/ponovi")).toBe("/administracija/api/v1/institucije/x/ponovi");
  });

  it("login and logout go to /prijava, which Next prefixes with the base path", () => {
    // router.replace() and redirect() get the base path from Next, so the
    // target is written without it; with it the URL would be doubled.
    for (const f of ["src/components/Odjava.jsx", "src/components/DodajInstituciju.jsx", "src/components/PonoviPokusaj.jsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/router\.replace\("\/prijava"\)/);
    }
    for (const f of ["app/page.jsx", "app/institucije/[id]/page.jsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/redirect\("\/prijava"\)/);
    }
    expect(readFileSync("src/components/ObrazacPrijave.jsx", "utf8")).toMatch(/router\.replace\("\/"\)/);
  });

  it("the plain link back from the unavailable page carries the new base path", () => {
    // A plain <a> gets no base path from Next.
    expect(renderToStaticMarkup(createElement(Nedostupno))).toContain('href="/administracija/"');
  });

  it("no source in app/ or src/ points at an old /admin address", () => {
    for (const s of ['"/admin"', "'/admin/prijava'", "`/admin/institucije/${id}`", '"/admin?x=1"']) expect(s).toMatch(STARA_ADRESA);
    for (const s of ['"/api/admin/ja"', '"/administracija/"', '"/admini"', "`/api/admin/institutions/${id}`"]) {
      expect(s).not.toMatch(STARA_ADRESA);
    }
    const izvori = [...datoteke("app"), ...datoteke("src"), "next.config.mjs"];
    expect(izvori.length).toBeGreaterThan(10);
    for (const f of izvori) expect(readFileSync(f, "utf8"), f).not.toMatch(STARA_ADRESA);
  });
});
