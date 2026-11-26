// POST /administracija/api/prijava -> Aplication_server POST /api/admin/prijava.
import { kolaciciZaPreglednik, pozoviServer } from "../../../src/server/aplication-server.js";
import { nedozvoljeno, odgovor, procitajMutaciju } from "../../../src/server/bff.js";

const tekst = (v) => typeof v === "string" && v.length >= 1 && v.length <= 256;

export async function POST(request) {
  const m = await procitajMutaciju(request);
  if ("odbijeno" in m) return m.odbijeno;
  const { korisnickoIme, lozinka } = m.tijelo;
  if (!tekst(korisnickoIme) || !tekst(lozinka)) return odgovor({ greska: "neispravan_unos" }, 400);

  const res = await pozoviServer("/api/admin/prijava", { method: "POST", tijelo: { korisnickoIme, lozinka } });
  if (!res) return odgovor({ greska: "nedostupan" }, 502);
  if (res.ok) return odgovor(null, 204, kolaciciZaPreglednik(res));
  if (res.status === 401) return odgovor({ greska: "pogresni_podaci" }, 401);
  if (res.status === 429) {
    const s = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
    return odgovor({ greska: "previse_pokusaja", nakonSekundi: Number.isSafeInteger(s) && s > 0 ? s : null }, 429);
  }
  return odgovor({ greska: "nedostupan" }, 502);
}

const ALLOW = "POST";
export const GET = nedozvoljeno(ALLOW);
export { GET as PUT, GET as PATCH, GET as DELETE };
