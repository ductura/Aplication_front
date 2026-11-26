// POST /administracija/api/institucije/{id}/ponovi -> Aplication_server POST /api/admin/institutions/{id}/ponovi.
// Retries the instance start for an institution that is still zatrazena or u_izradi.
// Answers 200 {institucija: {id, stanje}} or {greska} with the status the browser should act on.
import { pozoviServer, procitajJson } from "../../../../../src/server/aplication-server.js";
import { kolacicZahtjeva, nedozvoljeno, odgovor, procitajMutaciju } from "../../../../../src/server/bff.js";

const ID = /^[A-Za-z0-9-]{1,64}$/;

export async function POST(request, { params }) {
  const m = await procitajMutaciju(request);
  if ("odbijeno" in m) return m.odbijeno;
  const kolacic = kolacicZahtjeva(request);
  if (!kolacic) return odgovor({ greska: "nije_prijavljen" }, 401);
  const { id } = await params;
  if (!ID.test(id)) return odgovor({ greska: "nema" }, 404);

  const res = await pozoviServer(`/api/admin/institutions/${encodeURIComponent(id)}/ponovi`, {
    method: "POST",
    tijelo: {},
    kolacic,
  });
  if (!res) return odgovor({ greska: "nedostupan" }, 502);
  if (res.status === 401) return odgovor({ greska: "nije_prijavljen" }, 401);
  if (res.status === 404) return odgovor({ greska: "nema" }, 404);
  if (res.status === 409) return odgovor({ greska: "nije_ponovljivo" }, 409);
  if (res.status === 200 || res.status === 202) {
    const tijelo = await procitajJson(res);
    const stanje = tijelo?.institucija?.provisioning?.stanje;
    return odgovor({ institucija: { id, stanje: typeof stanje === "string" ? stanje : null } }, 200);
  }
  return odgovor({ greska: "nedostupan" }, 502);
}

export const GET = nedozvoljeno("POST");
export { GET as PUT, GET as PATCH, GET as DELETE };
