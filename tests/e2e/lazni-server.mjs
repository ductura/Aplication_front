// Fake Aplication_server for e2e (and local work without the real one). Only
// invented data: one admin, a few faculties, institutions in memory. The
// routes and fields follow ductura/Aplication_server (institutions/stvori.js)
// and ugovor c.6993786629 §3.4. Each GET of the list moves a new instance one
// state forward (zatrazena -> u_izradi -> aktivna) so the detail page can be tested;
// a domain starting with "odbijena." ends in greska (domena_zauzeta), as
// Aplication_server records a final refusal of Institution_server.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.LAZNI_PORT ?? 3199);
const ADMIN = { korisnickoIme: "admin-test", lozinka: "lozinka-samo-za-test" };
const ZAKLJUCAN = "zakljucan-test"; // always 429
const FAKULTETI = [
  { id: "fpzg", naziv: "Fakultet političkih znanosti", web: "http://www.fpzg.hr" },
  { id: "ffzg", naziv: "Filozofski fakultet", web: "http://www.ffzg.hr" },
  { id: "pmf", naziv: "Prirodoslovno-matematički fakultet", web: "http://www.pmf.hr" },
];
const ULOGE = { student: [0, 50_000], teacher: [0, 5_000], institution_admin: [1, 20], network_engineer: [0, 20] };
const HOME_ORG = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

let sesije = new Set();
let institucije = [];
const SLJEDECE = { zatrazena: "u_izradi", u_izradi: "aktivna" };

const posalji = (res, status, tijelo, zaglavlja = {}) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...zaglavlja });
  res.end(tijelo === undefined ? "" : JSON.stringify(tijelo));
};
const kolacic = (req) => /(?:^|;\s*)ductura_admin=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
const citaj = (req) =>
  new Promise((ok) => {
    let s = "";
    req.on("data", (d) => (s += d));
    req.on("end", () => {
      try {
        ok(JSON.parse(s));
      } catch {
        ok(null);
      }
    });
  });

function stvori(ulaz) {
  const f = FAKULTETI.find((x) => x.id === ulaz?.fakultetId);
  if (!f) return [400, { error: "nepoznat_fakultet", poruka: "fakultetId nije na popisu fakulteta" }];
  const d = typeof ulaz.aaiDomena === "string" ? ulaz.aaiDomena.trim().toLowerCase() : "";
  if (!HOME_ORG.test(d)) return [400, { error: "neispravan_unos", poruka: "aaiDomena nije ispravna domena" }];
  const racuni = {};
  for (const [u, [min, max]] of Object.entries(ULOGE)) {
    const n = ulaz.racuni?.[u] ?? 0;
    if (!Number.isSafeInteger(n) || n < min || n > max) {
      return [400, { error: "neispravan_unos", poruka: `${u}: broj računa mora biti cijeli broj od ${min} do ${max}` }];
    }
    racuni[u] = n;
  }
  if (institucije.some((i) => i.fakultetId === f.id || i.aaiDomena === d)) {
    return [409, { error: "vec_postoji", poruka: "institucija za taj fakultet ili tu AAI domenu već postoji" }];
  }
  const sada = new Date().toISOString();
  const inst = {
    id: randomUUID(),
    fakultetId: f.id,
    slug: f.id,
    naziv: f.naziv,
    aaiDomena: d,
    issuer: "http://localhost:8090",
    racuni: Object.fromEntries(Object.entries(racuni).filter(([, n]) => n > 0)),
    stvorena: sada,
    provisioning: { stanje: "zatrazena", zatrazeno: sada, aktivirano: null, kodGreske: null, zadnjaGreska: null, pokusaja: 0 },
  };
  institucije.push(inst);
  return [201, { institucija: inst }];
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const r = `${req.method} ${url.pathname}`;
  if (r === "GET /__zdravlje") return posalji(res, 200, { ok: true });
  if (r === "POST /__reset") {
    sesije = new Set();
    institucije = [];
    return posalji(res, 204);
  }
  if (r === "POST /api/admin/prijava") {
    const t = await citaj(req);
    if (t?.korisnickoIme === ZAKLJUCAN) return posalji(res, 429, { error: "previse_pokusaja" }, { "retry-after": "120" });
    if (t?.korisnickoIme !== ADMIN.korisnickoIme || t?.lozinka !== ADMIN.lozinka) {
      return posalji(res, 401, { error: "pogresni_podaci" });
    }
    const id = randomUUID();
    sesije.add(id);
    return posalji(res, 204, undefined, {
      "set-cookie": `ductura_admin=${id}; Path=/; HttpOnly; SameSite=Strict`,
    });
  }
  const prijavljen = sesije.has(kolacic(req));
  if (r === "POST /api/admin/odjava") {
    sesije.delete(kolacic(req));
    return posalji(res, 204, undefined, { "set-cookie": "ductura_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict" });
  }
  if (!url.pathname.startsWith("/api/admin/")) return posalji(res, 404, { error: "nema" });
  if (!prijavljen) return posalji(res, 401, { error: "nije_prijavljen" });
  if (r === "GET /api/admin/ja") return posalji(res, 200, { korisnickoIme: ADMIN.korisnickoIme });
  if (r === "GET /api/admin/fakulteti") return posalji(res, 200, { fakulteti: FAKULTETI });
  if (r === "GET /api/admin/institutions") {
    const odgovor = { institucije: structuredClone(institucije) };
    for (const i of institucije) {
      const p = i.provisioning;
      if (p.stanje === "u_izradi" && i.aaiDomena.startsWith("odbijena.")) {
        Object.assign(p, { stanje: "greska", kodGreske: "domena_zauzeta", zadnjaGreska: "409 domena_zauzeta" });
      } else if (SLJEDECE[p.stanje]) p.stanje = SLJEDECE[p.stanje];
      p.pokusaja += 1;
      if (p.stanje === "aktivna" && !p.aktivirano) p.aktivirano = new Date().toISOString();
    }
    return posalji(res, 200, odgovor);
  }
  if (r === "POST /api/admin/institutions") {
    const [status, tijelo] = stvori(await citaj(req));
    return posalji(res, status, tijelo);
  }
  return posalji(res, 405, { error: "metoda" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`lazni Aplication_server na http://127.0.0.1:${PORT}`));
