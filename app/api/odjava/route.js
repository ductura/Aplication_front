// POST /admin/api/odjava -> Aplication_server POST /api/admin/odjava. The
// cookie is cleared here as well, so logout works even when the server is down.
import { kolaciciZaPreglednik, obrisiKolacic, pozoviServer } from "../../../src/server/aplication-server.js";
import { kolacicZahtjeva, nedozvoljeno, odgovor, procitajMutaciju } from "../../../src/server/bff.js";

export async function POST(request) {
  const m = await procitajMutaciju(request);
  if (m.odbijeno) return m.odbijeno;
  const kolacic = kolacicZahtjeva(request);
  const res = kolacic ? await pozoviServer("/api/admin/odjava", { method: "POST", kolacic }) : null;
  const sa = res ? kolaciciZaPreglednik(res) : [];
  return odgovor(null, 204, sa.length ? sa : [obrisiKolacic()]);
}

export const GET = nedozvoljeno("POST");
export { GET as PUT, GET as PATCH, GET as DELETE };
