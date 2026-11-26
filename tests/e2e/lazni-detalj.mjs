// Detail and retry routes of the fake Aplication_server (APS-1302 contract as assumed by
// APF-1301): GET /api/admin/institutions/{id} -> {institucija: {..., pokusaji: [...]}},
// POST .../{id}/ponovi -> 202 {institucija} for zatrazena, u_izradi and greska (DAN-1532), 409 otherwise,
// 404 for an unknown id. Test hook: POST /__stanje/{id} sets provisioning and attempts.
// Without the hook the detail read moves the instance forward like the list read does
// (zatrazena -> u_izradi -> aktivna, "odbijena." domains end in greska); after the hook the state is fixed.
// An institution whose domain starts with "nedostupna." answers 503 on both routes.
const SLJEDECE = { zatrazena: "u_izradi", u_izradi: "aktivna" };
const DETALJ = /^\/api\/admin\/institutions\/([^/]+)(\/ponovi)?$/;

export function rukujDetaljem(req, res, url, { institucije, prijavljen, posalji, citaj }) {
  const hook = /^\/__stanje\/([^/]+)$/.exec(url.pathname);
  if (hook && req.method === "POST") {
    return citaj(req).then((t) => {
      const i = institucije.find((x) => x.id === hook[1]);
      if (!i) return posalji(res, 404, { error: "nema" });
      Object.assign(i.provisioning, t?.provisioning ?? {});
      i.pokusaji = Array.isArray(t?.pokusaji) ? t.pokusaji : i.pokusaji;
      i.fiksno = true;
      return posalji(res, 204);
    });
  }
  const m = DETALJ.exec(url.pathname);
  if (!m) return false;
  const ponovi = Boolean(m[2]);
  if ((ponovi ? "POST" : "GET") !== req.method) return posalji(res, 405, { error: "metoda" });
  if (!prijavljen) return posalji(res, 401, { error: "nije_prijavljen" });
  const i = institucije.find((x) => x.id === m[1]);
  if (!i) return posalji(res, 404, { error: "nema" });
  if (i.aaiDomena.startsWith("nedostupna.")) return posalji(res, 503, { error: "nedostupno" });
  i.pokusaji ??= [];
  if (ponovi) {
    const p = i.provisioning;
    if (p.stanje === "aktivna") return posalji(res, 409, { error: "nije_ponovljivo" });
    const sada = new Date().toISOString();
    i.pokusaji.push({ vrijeme: sada, ishod: "uspjeh", kodGreske: null });
    Object.assign(p, { stanje: "aktivna", aktivirano: sada, kodGreske: null, zadnjaGreska: null });
    return posalji(res, 202, { institucija: structuredClone(i) });
  }
  const odgovor = structuredClone(i);
  const p = i.provisioning;
  if (!i.fiksno) {
    if (p.stanje === "u_izradi" && i.aaiDomena.startsWith("odbijena.")) {
      Object.assign(p, { stanje: "greska", kodGreske: "domena_zauzeta", zadnjaGreska: "409 domena_zauzeta" });
    } else if (SLJEDECE[p.stanje]) p.stanje = SLJEDECE[p.stanje];
    p.pokusaja = (p.pokusaja ?? 0) + 1;
    if (p.stanje === "aktivna" && !p.aktivirano) p.aktivirano = new Date().toISOString();
  }
  return posalji(res, 200, { institucija: odgovor });
}
