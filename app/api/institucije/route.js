// POST /admin/api/institucije -> Aplication_server POST /api/admin/institutions.
// Answers 201 {institucija} or {greska, polja} with an error code per field.
import { greskaStvaranja, normalizirajDomenu, provjeriUnos, ULOGE } from "../../../src/lib/institucija.js";
import { pozoviServer, procitajJson } from "../../../src/server/aplication-server.js";
import { kolacicZahtjeva, nedozvoljeno, odgovor, procitajMutaciju } from "../../../src/server/bff.js";

export async function POST(request) {
  const m = await procitajMutaciju(request);
  if (m.odbijeno) return m.odbijeno;
  const kolacic = kolacicZahtjeva(request);
  if (!kolacic) return odgovor({ greska: "nije_prijavljen", polja: {} }, 401);

  const t = m.tijelo && typeof m.tijelo === "object" ? m.tijelo : {};
  const unos = {
    fakultetId: typeof t.fakultetId === "string" ? t.fakultetId : "",
    aaiDomena: typeof t.aaiDomena === "string" ? normalizirajDomenu(t.aaiDomena) : "",
    racuni: Object.fromEntries(ULOGE.map(([u]) => [u, t.racuni?.[u]])),
  };
  const polja = provjeriUnos(unos);
  if (Object.keys(polja).length) return odgovor({ greska: "neispravan_unos", polja }, 400);

  const res = await pozoviServer("/api/admin/institutions", { method: "POST", tijelo: unos, kolacic });
  if (!res) return odgovor({ greska: "nedostupan", polja: {} }, 502);
  const tijelo = await procitajJson(res);
  if (res.status === 201 || res.status === 200) {
    const institucija = tijelo?.institucija;
    if (!institucija || typeof institucija.id !== "string") return odgovor({ greska: "nedostupan", polja: {} }, 502);
    return odgovor({ institucija: { id: institucija.id } }, 201);
  }
  let postojece = [];
  if (res.status === 409) {
    const popis = await pozoviServer("/api/admin/institutions", { kolacic });
    const p = popis?.ok ? await procitajJson(popis) : null;
    postojece = Array.isArray(p?.institucije) ? p.institucije : [];
  }
  const g = greskaStvaranja(res.status, tijelo, unos, postojece);
  const status = { nije_prijavljen: 401, zauzeto: 409, neispravan_unos: 400, issuer: 502, nedostupan: 502 }[g.greska];
  return odgovor(g, status);
}

export const GET = nedozvoljeno("POST");
export { GET as PUT, GET as PATCH, GET as DELETE };
