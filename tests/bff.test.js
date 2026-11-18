import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as institucije from "../app/api/institucije/route.js";
import * as odjava from "../app/api/odjava/route.js";
import * as prijava from "../app/api/prijava/route.js";
import { izvuciKolacic, kolaciciZaPreglednik } from "../src/server/aplication-server.js";

let pozivi;
let odgovori;
beforeEach(() => {
  pozivi = [];
  odgovori = [];
  process.env.APLICATION_SERVER_URL = "http://server.test:3110/";
  vi.stubGlobal("fetch", async (url, init) => {
    pozivi.push({ url, ...init, tijelo: init.body === undefined ? undefined : JSON.parse(init.body) });
    const o = odgovori.shift();
    if (o instanceof Error) throw o;
    return o;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.APLICATION_SERVER_URL;
});

const zahtjev = (putanja, tijelo, zaglavlja = {}) =>
  new Request(`http://127.0.0.1:3120/admin/api${putanja}`, {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...zaglavlja },
    body: typeof tijelo === "string" ? tijelo : JSON.stringify(tijelo),
  });
const json = (status, body, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers });

describe("cookie handling", () => {
  it("reads only ductura_admin and only a valid cookie value", () => {
    expect(izvuciKolacic("a=1; ductura_admin=abc.DEF-1; b=2")).toBe("abc.DEF-1");
    expect(izvuciKolacic("xductura_admin=1")).toBeNull();
    expect(izvuciKolacic("ductura_admin=a b")).toBeNull();
    expect(izvuciKolacic("ductura_admin=a,b")).toBeNull();
    expect(izvuciKolacic(null)).toBeNull();
  });

  it("passes back only Set-Cookie for ductura_admin", () => {
    const h = new Headers();
    h.append("set-cookie", "ductura_admin=s1; Path=/; HttpOnly; SameSite=Strict");
    h.append("set-cookie", "drugi=x; Path=/");
    expect(kolaciciZaPreglednik(new Response(null, { headers: h }))).toEqual(["ductura_admin=s1; Path=/; HttpOnly; SameSite=Strict"]);
  });
});

describe("POST /admin/api/prijava", () => {
  const podaci = { korisnickoIme: "admin-test", lozinka: "lozinka-samo-za-test" };

  it("forwards the credentials and returns the session cookie", async () => {
    odgovori.push(json(204, null, { "set-cookie": "ductura_admin=s1; Path=/; HttpOnly; SameSite=Strict" }));
    const res = await prijava.POST(zahtjev("/prijava", { ...podaci, visak: 1 }));
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toEqual(["ductura_admin=s1; Path=/; HttpOnly; SameSite=Strict"]);
    expect(pozivi[0].url).toBe("http://server.test:3110/api/admin/prijava");
    expect(pozivi[0].method).toBe("POST");
    expect(pozivi[0].tijelo).toEqual(podaci);
    expect(pozivi[0].headers.cookie).toBeUndefined();
  });

  it("401, 429 with Retry-After, and an unreachable server", async () => {
    odgovori.push(json(401, { error: "x" }));
    let res = await prijava.POST(zahtjev("/prijava", podaci));
    expect([res.status, await res.json()]).toEqual([401, { greska: "pogresni_podaci" }]);
    odgovori.push(json(429, {}, { "retry-after": "90" }));
    res = await prijava.POST(zahtjev("/prijava", podaci));
    expect([res.status, await res.json()]).toEqual([429, { greska: "previse_pokusaja", nakonSekundi: 90 }]);
    odgovori.push(json(429, {}));
    res = await prijava.POST(zahtjev("/prijava", podaci));
    expect((await res.json()).nakonSekundi).toBeNull();
    odgovori.push(new TypeError("fetch failed"));
    res = await prijava.POST(zahtjev("/prijava", podaci));
    expect(res.status).toBe(502);
  });

  it("refuses cross-site, non-JSON and empty input without calling the server", async () => {
    expect((await prijava.POST(zahtjev("/prijava", podaci, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await prijava.POST(zahtjev("/prijava", podaci, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await prijava.POST(zahtjev("/prijava", "{"))).status).toBe(400);
    expect((await prijava.POST(zahtjev("/prijava", { korisnickoIme: "", lozinka: "x" }))).status).toBe(400);
    expect((await prijava.POST(zahtjev("/prijava", { korisnickoIme: "a", lozinka: 5 }))).status).toBe(400);
    expect((await prijava.POST(zahtjev("/prijava", "x".repeat(17 * 1024)))).status).toBe(413);
    expect(prijava.GET().status).toBe(405);
    expect(pozivi).toEqual([]);
  });
});

describe("POST /admin/api/odjava", () => {
  it("forwards the cookie and passes back the server's clearing cookie", async () => {
    odgovori.push(json(204, null, { "set-cookie": "ductura_admin=; Path=/; Max-Age=0" }));
    const res = await odjava.POST(zahtjev("/odjava", {}, { cookie: "ductura_admin=s1; drugi=x" }));
    expect(res.status).toBe(204);
    expect(pozivi[0].headers.cookie).toBe("ductura_admin=s1");
    expect(res.headers.getSetCookie()).toEqual(["ductura_admin=; Path=/; Max-Age=0"]);
  });

  it("clears the cookie itself when the server is down", async () => {
    odgovori.push(new TypeError("fetch failed"));
    const res = await odjava.POST(zahtjev("/odjava", {}, { cookie: "ductura_admin=s1" }));
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()[0]).toMatch(/^ductura_admin=; Path=\/; Max-Age=0; HttpOnly; SameSite=Strict$/);
  });
});

describe("POST /admin/api/institucije", () => {
  const unos = { fakultetId: "fpzg", aaiDomena: " FPZG.hr ", racuni: { student: 200, teacher: 50, network_engineer: 3, institution_admin: 1 } };
  const sKolacicem = (t) => zahtjev("/institucije", t, { cookie: "ductura_admin=s1" });

  it("sends the normalised input with the cookie and returns only the new id", async () => {
    odgovori.push(json(201, { institucija: { id: "i-1", provisioning: { payload: { first_admin: {} } } } }));
    const res = await institucije.POST(sKolacicem(unos));
    expect([res.status, await res.json()]).toEqual([201, { institucija: { id: "i-1" } }]);
    expect(pozivi[0].url).toBe("http://server.test:3110/api/admin/institutions");
    expect(pozivi[0].headers.cookie).toBe("ductura_admin=s1");
    expect(pozivi[0].tijelo).toEqual({ ...unos, aaiDomena: "fpzg.hr" });
  });

  it("without a cookie answers 401 and invalid input 400 per field, both without calling the server", async () => {
    let res = await institucije.POST(zahtjev("/institucije", unos));
    expect(res.status).toBe(401);
    res = await institucije.POST(sKolacicem({ ...unos, aaiDomena: "x", racuni: { ...unos.racuni, institution_admin: 0 } }));
    expect([res.status, await res.json()]).toEqual([
      400,
      { greska: "neispravan_unos", polja: { aaiDomena: "neispravno", "racuni.institution_admin": "neispravno" } },
    ]);
    expect(pozivi).toEqual([]);
  });

  it("409 reads the current list to name the taken field", async () => {
    odgovori.push(json(409, { error: "vec_postoji" }), json(200, { institucije: [{ fakultetId: "ffzg", aaiDomena: "fpzg.hr" }] }));
    const res = await institucije.POST(sKolacicem(unos));
    expect([res.status, await res.json()]).toEqual([409, { greska: "zauzeto", polja: { aaiDomena: "zauzeto" } }]);
    expect(pozivi[1].method).toBe("GET");
    expect(pozivi[1].headers.cookie).toBe("ductura_admin=s1");
  });

  it("server 400, 401 and failures", async () => {
    odgovori.push(json(400, { error: "nepoznat_fakultet" }));
    let res = await institucije.POST(sKolacicem(unos));
    expect([res.status, await res.json()]).toEqual([400, { greska: "neispravan_unos", polja: { fakultetId: "nepoznato" } }]);
    odgovori.push(json(401, { error: "nije_prijavljen" }));
    expect((await institucije.POST(sKolacicem(unos))).status).toBe(401);
    odgovori.push(json(503, { error: "admin_nije_dostupan" }));
    expect((await institucije.POST(sKolacicem(unos))).status).toBe(502);
    odgovori.push(json(201, { institucija: {} }));
    expect((await institucije.POST(sKolacicem(unos))).status).toBe(502);
    odgovori.push(new TypeError("fetch failed"));
    expect((await institucije.POST(sKolacicem(unos))).status).toBe(502);
  });
});
