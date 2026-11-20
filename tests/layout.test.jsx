import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "../app/layout.jsx";
import GlobalError from "../app/global-error.jsx";
import NotFound from "../app/not-found.jsx";
import Page from "../app/page.jsx";
import Institucija from "../app/institucije/[id]/page.jsx";
import Prijava from "../app/prijava/page.jsx";
import { hr } from "../src/i18n/hr.js";

const kolacic = { value: "sesija-test" };
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n) => (n === "ductura_admin" ? kolacic.value && kolacic : undefined) }) }));
vi.mock("next/navigation", () => ({
  redirect: (url) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
}));

const INST = {
  id: "11111111-1111-4111-8111-111111111111",
  fakultetId: "fpzg",
  slug: "fpzg",
  naziv: "Fakultet političkih znanosti",
  aaiDomena: "fpzg.hr",
  issuer: "http://localhost:8090",
  racuni: { student: 200, teacher: 50, network_engineer: 3, institution_admin: 1 },
  provisioning: { stanje: "u_izradi", zatrazeno: "2026-11-18T22:00:00Z", aktivirano: null },
};
let odgovori;
beforeEach(() => {
  kolacic.value = "sesija-test";
  odgovori = {
    "/api/admin/ja": [200, { korisnickoIme: "admin-test" }],
    "/api/admin/institutions": [200, { institucije: [INST] }],
    "/api/admin/fakulteti": [200, { fakulteti: [{ id: "fpzg", naziv: INST.naziv, web: null }] }],
  };
  vi.stubGlobal("fetch", async (url, init) => {
    expect(init.headers.cookie).toBe("ductura_admin=sesija-test");
    const [status, body] = odgovori[new URL(url).pathname];
    return Response.json(body, { status });
  });
});
afterEach(() => vi.unstubAllGlobals());

const redirectNa = async (p) => {
  try {
    await p;
  } catch (e) {
    return e.url;
  }
  return null;
};

it("renders Croatian html with catalogue metadata", () => {
  expect(renderToStaticMarkup(<RootLayout><p /></RootLayout>)).toMatch(/^<html lang="hr"/);
  expect(metadata.title).toBe(hr.app.name);
});

it("home page shows the institutions with accounts per role on a near-white sheet", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(hr.app.name);
  expect(html).toMatch(/data-sheet-theme="light"/);
  expect(html).toContain(INST.naziv);
  expect(html).toContain(`/institucije/${INST.id}`);
  for (const n of [200, 50, 3, 1]) expect(html).toContain(`>${n}</td>`);
  expect(html).toContain(hr.instanca.stanja.u_izradi);
  expect(html).toContain(hr.institucije.dodaj);
});

it("without a cookie or with a 401 the pages send the browser to the login page", async () => {
  odgovori["/api/admin/ja"] = [401, { error: "nije_prijavljen" }];
  expect(await redirectNa(Page())).toBe("/prijava");
  expect(await redirectNa(Institucija({ params: Promise.resolve({ id: INST.id }) }))).toBe("/prijava");
  kolacic.value = null;
  expect(await redirectNa(Page())).toBe("/prijava");
  expect(renderToStaticMarkup(await Prijava())).toContain(hr.prijava.korisnickoIme);
});

it("a signed-in admin opening the login page goes to /", async () => {
  expect(await redirectNa(Prijava())).toBe("/");
});

it("detail page shows the instance state and the accounts", async () => {
  const html = renderToStaticMarkup(await Institucija({ params: Promise.resolve({ id: INST.id }) }));
  expect(html).toContain(hr.instanca.stanja.u_izradi);
  expect(html).toContain(hr.instanca.opis.u_izradi);
  expect(html).toContain(hr.instanca.osvjezava);
  expect(html).toContain("fpzg.hr");
  const nema = renderToStaticMarkup(await Institucija({ params: Promise.resolve({ id: "drugi" }) }));
  expect(nema).toContain(hr.instanca.nema);
});

it("detail page shows a refused instance with its reason and a failed attempt in progress", async () => {
  const sa = (provisioning) => {
    odgovori["/api/admin/institutions"] = [200, { institucije: [{ ...INST, provisioning: { ...INST.provisioning, ...provisioning } }] }];
    return Institucija({ params: Promise.resolve({ id: INST.id }) }).then(renderToStaticMarkup);
  };
  const odbijena = await sa({ stanje: "greska", kodGreske: "slug_zauzet", zadnjaGreska: "409", pokusaja: 1 });
  expect(odbijena).toContain(hr.instanca.stanja.greska);
  expect(odbijena).toContain(hr.instanca.kodovi.slug_zauzet);
  expect(odbijena).not.toContain(hr.instanca.osvjezava);
  const ponovno = await sa({ stanje: "u_izradi", zadnjaGreska: "503", pokusaja: 2 });
  expect(ponovno).toContain(hr.instanca.neuspjeliPokusaj(2));
  expect(ponovno).toContain(hr.instanca.osvjezava);
  const aktivna = await sa({ stanje: "aktivna", aktivirano: "2026-11-18T22:05:00Z" });
  expect(aktivna).not.toContain(hr.instanca.osvjezava);
});

it("an unreachable server shows a message instead of data", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("fetch failed");
  });
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain(hr.greske.nedostupan);
  expect(html).not.toContain(hr.institucije.dodaj);
});

it("repository has no TypeScript", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
  expect(files.split("\n").filter((f) => /\.(ts|tsx|mts|cts)$|(^|\/)tsconfig[^/]*\.json$/.test(f))).toEqual([]);
});

it("404 page uses catalogue text and links home", () => {
  const html = renderToStaticMarkup(<NotFound />);
  expect(html).toContain(hr.notFound.naslov);
  expect(html).toMatch(new RegExp(`<a [^>]*href="/"[^>]*>${hr.notFound.natrag}</a>`));
});

it("global error page is Croatian, from the catalogue and hides error details", () => {
  const html = renderToStaticMarkup(<GlobalError error={new Error("tajni detalj")} retry={() => {}} />);
  expect(html).toMatch(/^<html lang="hr"/);
  expect(html).toContain(hr.error.heading);
  expect(html).toContain(hr.error.retry);
  expect(html).not.toContain("tajni detalj");
});
