import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Institucija from "../app/institucije/[id]/page.jsx";
import * as ponovi from "../app/api/institucije/[id]/ponovi/route.js";
import PonoviPokusaj, { posaljiPonovi } from "../src/components/PonoviPokusaj.jsx";
import PovijestPokusaja from "../src/components/PovijestPokusaja.jsx";
import { hr } from "../src/i18n/hr.js";

const kolacic = { value: "sesija-test" };
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n) => (n === "ductura_admin" ? kolacic.value && kolacic : undefined) }) }));
vi.mock("next/navigation", () => ({
  redirect: (url) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
}));

const ID = "22222222-2222-4222-8222-222222222222";
const INST = {
  id: ID,
  slug: "ffzg",
  naziv: "Filozofski fakultet",
  aaiDomena: "ffzg.hr",
  issuer: "http://localhost:8090",
  racuni: { student: 10, institution_admin: 1 },
  provisioning: { stanje: "u_izradi", zatrazeno: "2026-11-18T22:00:00Z", aktivirano: null },
  pokusaji: [
    { vrijeme: "2026-11-18T22:01:00Z", ishod: "neuspjeh", kodGreske: "slug_zauzet" },
    { vrijeme: "2026-11-18T22:03:00Z", ishod: "neuspjeh", kodGreske: "servis_nedostupan" },
    { vrijeme: "2026-11-18T22:02:00Z", ishod: "uspjeh", kodGreske: null },
  ],
};
let detalj;
let ja;
beforeEach(() => {
  kolacic.value = "sesija-test";
  ja = [200, { korisnickoIme: "admin-test" }];
  detalj = [200, { institucija: INST }];
  vi.stubGlobal("fetch", async (url) => {
    const putanja = new URL(url).pathname;
    const [status, body] = putanja === "/api/admin/ja" ? ja : putanja === `/api/admin/institutions/${ID}` ? detalj : [404, {}];
    return Response.json(body, { status });
  });
});
afterEach(() => vi.unstubAllGlobals());

const prikazi = async (id = ID) => renderToStaticMarkup(await Institucija({ params: Promise.resolve({ id }) }));
const redirectNa = async (p) => {
  try {
    await p;
  } catch (e) {
    return e.url;
  }
  return null;
};
const sa = (provisioning, ostalo = {}) => {
  detalj = [200, { institucija: { ...INST, ...ostalo, provisioning: { ...INST.provisioning, ...provisioning } } }];
  return prikazi();
};

describe("detail page: attempt history", () => {
  it("lists attempts newest first with time, outcome and error code", async () => {
    const html = await prikazi();
    expect(html).toContain(hr.povijest.naslov);
    for (const k of Object.values(hr.povijest.stupci)) expect(html).toContain(k);
    expect(html).toContain("<code>slug_zauzet</code>");
    expect(html).toContain(hr.povijest.ishodi.uspjeh);
    expect(html.indexOf("servis_nedostupan")).toBeLessThan(html.indexOf("slug_zauzet"));
    expect(html).toMatch(/18\. ?11\. ?2026\.? ?23:03/);
  });

  it("shows an empty message without attempts and ignores malformed entries", async () => {
    expect(await sa({}, { pokusaji: [] })).toContain(hr.povijest.prazno);
    expect(await sa({}, { pokusaji: undefined })).toContain(hr.povijest.prazno);
    const html = renderToStaticMarkup(<PovijestPokusaja pokusaji={[null, 5, { vrijeme: "nije datum", ishod: "x", kodGreske: 3 }]} />);
    expect(html).toContain("—");
    expect(html).not.toContain("<code>");
  });
});

describe("detail page: states and retry button", () => {
  it.each([
    ["zatrazena", true],
    ["u_izradi", true],
    ["aktivna", false],
    ["greska", false],
  ])("state %s shows the retry button: %s", async (stanje, prikazan) => {
    const html = await sa({ stanje, kodGreske: stanje === "greska" ? "domena_zauzeta" : null });
    expect(html).toContain(hr.instanca.stanja[stanje]);
    expect(html.includes(hr.ponovi.gumb)).toBe(prikazan);
    expect(html.includes(hr.instanca.osvjezava)).toBe(prikazan);
  });

  it("a refused instance shows its reason", async () => {
    const html = await sa({ stanje: "greska", kodGreske: "domena_zauzeta" });
    expect(html).toContain(hr.instanca.kodovi.domena_zauzeta);
  });

  it("the button renders enabled with its help text", () => {
    const html = renderToStaticMarkup(<PonoviPokusaj id={ID} />);
    expect(html).toContain(hr.ponovi.gumb);
    expect(html).toContain(hr.ponovi.pomoc);
    expect(html).not.toContain("disabled");
  });
});

describe("detail page: errors", () => {
  it("401 from the session or from the detail sends the browser to the login page", async () => {
    detalj = [401, { error: "nije_prijavljen" }];
    expect(await redirectNa(prikazi())).toBe("/prijava");
    detalj = [200, { institucija: INST }];
    ja = [401, {}];
    expect(await redirectNa(prikazi())).toBe("/prijava");
  });

  it("404 shows that the institution was not found", async () => {
    detalj = [404, { error: "nema" }];
    const html = await prikazi();
    expect(html).toContain(hr.instanca.nema);
    expect(html).not.toContain(hr.ponovi.gumb);
  });

  it.each([503, 500])("%i and an unreachable server show the unavailable message", async (status) => {
    detalj = [status, {}];
    expect(await prikazi()).toContain(hr.greske.nedostupan);
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    expect(await prikazi()).toContain(hr.greske.nedostupan);
  });

  it("an answer without an institution is treated as unavailable", async () => {
    detalj = [200, { institucija: null }];
    expect(await prikazi()).toContain(hr.greske.nedostupan);
  });
});

describe("posaljiPonovi maps BFF answers", () => {
  const sOdgovorom = (status) => vi.fn(async () => new Response(null, { status }));
  it.each([
    [200, "ok"],
    [401, "prijava"],
    [404, "nema"],
    [409, "nije_ponovljivo"],
    [502, "nedostupan"],
    [503, "nedostupan"],
    [400, "opce"],
  ])("%i -> %s", async (status, ishod) => {
    expect(await posaljiPonovi(ID, sOdgovorom(status))).toBe(ishod);
  });

  it("sends JSON to the retry route of the institution and treats a network error as unavailable", async () => {
    const f = sOdgovorom(200);
    await posaljiPonovi(ID, f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`/admin/api/institucije/${ID}/ponovi`);
    expect(init).toMatchObject({ method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(await posaljiPonovi(ID, async () => Promise.reject(new TypeError("x")))).toBe("nedostupan");
  });

  it("every message the button can show exists in the catalogue", () => {
    for (const k of ["nema", "nije_ponovljivo", "nedostupan", "opce"]) expect(hr.ponovi.greske[k]).toBeTruthy();
  });
});

describe("POST /admin/api/institucije/{id}/ponovi", () => {
  let pozivi;
  let odgovor;
  beforeEach(() => {
    pozivi = [];
    odgovor = () => Response.json({ institucija: { id: ID, provisioning: { stanje: "aktivna" } } }, { status: 202 });
    vi.stubGlobal("fetch", async (url, init) => {
      pozivi.push({ url, ...init });
      const o = odgovor();
      if (o instanceof Error) throw o;
      return o;
    });
  });
  const zahtjev = (zaglavlja = {}, tijelo = "{}") =>
    new Request(`http://127.0.0.1:3120/admin/api/institucije/${ID}/ponovi`, {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", cookie: "ductura_admin=s1; drugi=x", ...zaglavlja },
      body: tijelo,
    });
  const poziv = (z, id = ID) => ponovi.POST(z, { params: Promise.resolve({ id }) });

  it("forwards only the session cookie and returns the new state", async () => {
    const res = await poziv(zahtjev());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ institucija: { id: ID, stanje: "aktivna" } });
    expect(pozivi).toHaveLength(1);
    expect(pozivi[0].url).toMatch(new RegExp(`/api/admin/institutions/${ID}/ponovi$`));
    expect(pozivi[0].method).toBe("POST");
    expect(pozivi[0].headers.cookie).toBe("ductura_admin=s1");
  });

  it("refuses a cross-site request, a non-JSON body, a missing cookie and bad JSON without calling the server", async () => {
    expect((await poziv(zahtjev({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await poziv(zahtjev({ "content-type": "text/plain" }))).status).toBe(415);
    expect((await poziv(zahtjev({ cookie: "drugi=x" }))).status).toBe(401);
    expect((await poziv(zahtjev({}, "{nije json"))).status).toBe(400);
    expect(pozivi).toHaveLength(0);
  });

  it("rejects an id that is not a plain identifier", async () => {
    expect((await poziv(zahtjev(), "../../x")).status).toBe(404);
    expect((await poziv(zahtjev(), "a/b")).status).toBe(404);
    expect(pozivi).toEqual([]);
  });

  it.each([
    [401, 401, "nije_prijavljen"],
    [404, 404, "nema"],
    [409, 409, "nije_ponovljivo"],
    [503, 502, "nedostupan"],
    [500, 502, "nedostupan"],
  ])("server %i -> %i %s", async (s, status, greska) => {
    odgovor = () => new Response(null, { status: s });
    const res = await poziv(zahtjev());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ greska });
  });

  it("an unreachable server is 502 and other methods are 405", async () => {
    odgovor = () => new TypeError("fetch failed");
    expect((await poziv(zahtjev())).status).toBe(502);
    expect(ponovi.GET().status).toBe(405);
    expect(ponovi.GET().headers.get("allow")).toBe("POST");
  });
});
