// Shared by the form (browser) and the BFF (server): field rules that mirror
// Aplication_server institutions/stvori.js, and the mapping of its answers to
// error codes per field. Codes become text only in the UI (src/i18n/hr.js).

// [role, min, max]; institution_admin >= 1 because each institution needs its first admin.
export const ULOGE = Object.freeze([
  Object.freeze(["student", 0, 50_000]),
  Object.freeze(["teacher", 0, 5_000]),
  Object.freeze(["network_engineer", 0, 20]),
  Object.freeze(["institution_admin", 1, 20]),
]);

export const STANJA = Object.freeze(["zatrazena", "u_izradi", "aktivna", "greska"]);
// These can still change (institutions/podigni.js on Aplication_server); aktivna and greska are final.
export const U_TIJEKU = Object.freeze(["zatrazena", "u_izradi"]);

const HOME_ORG = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

// Same normalisation the server applies to hrEduPersonHomeOrg.
export const normalizirajDomenu = (d) =>
  String(d ?? "")
    .replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "")
    .replace(/[A-Z]/g, (c) => c.toLowerCase());

// "http://www.fpzg.hr" -> "fpzg.hr": only a suggestion for the domain field.
export function predloziDomenu(web) {
  if (typeof web !== "string") return "";
  try {
    const host = new URL(web).hostname.replace(/^www\./, "");
    return HOME_ORG.test(host) ? host : "";
  } catch {
    return "";
  }
}

/** @returns {Record<string, string>} field -> error code; empty when the input may be sent. */
export function provjeriUnos({ fakultetId, aaiDomena, racuni }) {
  const greske = {};
  if (!fakultetId) greske.fakultetId = "obavezno";
  const d = normalizirajDomenu(aaiDomena);
  if (!d) greske.aaiDomena = "obavezno";
  else if (d.length > 253 || !HOME_ORG.test(d)) greske.aaiDomena = "neispravno";
  for (const [uloga, min, max] of ULOGE) {
    const n = racuni?.[uloga];
    if (!Number.isSafeInteger(n) || n < min || n > max) greske[`racuni.${uloga}`] = "neispravno";
  }
  return greske;
}

/**
 * Turns an Aplication_server error answer for POST /api/admin/institutions
 * into `{greska, polja}`. 409 does not say which field is taken, so the
 * current list decides: the faculty, the domain, or both when neither matches
 * (the list changed in between).
 */
export function greskaStvaranja(status, tijelo, unos, postojece = []) {
  const kod = tijelo?.error ?? tijelo?.greska;
  if (status === 401) return { greska: "nije_prijavljen", polja: {} };
  if (status === 409) {
    const polja = {};
    if (postojece.some((i) => i.fakultetId === unos.fakultetId)) polja.fakultetId = "zauzeto";
    if (postojece.some((i) => i.aaiDomena === normalizirajDomenu(unos.aaiDomena))) polja.aaiDomena = "zauzeto";
    if (!polja.fakultetId && !polja.aaiDomena) return { greska: "zauzeto", polja: {} };
    return { greska: "zauzeto", polja };
  }
  if (status === 400 && kod === "nepoznat_fakultet") return { greska: "neispravan_unos", polja: { fakultetId: "nepoznato" } };
  if (status === 400 && kod === "neispravan_unos") {
    const poruka = typeof tijelo?.poruka === "string" ? tijelo.poruka : "";
    const polje = typeof tijelo?.polje === "string" ? tijelo.polje : "";
    if (polje === "aaiDomena" || poruka.startsWith("aaiDomena")) return { greska: kod, polja: { aaiDomena: "neispravno" } };
    const uloga = ULOGE.find(([u]) => polje === u || poruka.startsWith(`${u}:`));
    if (uloga) return { greska: kod, polja: { [`racuni.${uloga[0]}`]: "neispravno" } };
    if (/issuer/i.test(poruka)) return { greska: "issuer", polja: {} };
    return { greska: kod, polja: {} };
  }
  return { greska: "nedostupan", polja: {} };
}
