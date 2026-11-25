// Shared rules for the BFF route handlers under app/api.
import { izvuciKolacic } from "./aplication-server.js";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_TIJELO = 16 * 1024;

export const odgovor = (tijelo, status, dodatno = []) => {
  const headers = new Headers(NO_STORE);
  if (tijelo !== null) headers.set("content-type", "application/json");
  for (const c of dodatno) headers.append("set-cookie", c);
  return new Response(tijelo === null ? null : JSON.stringify(tijelo), { status, headers });
};

export const kolacicZahtjeva = (request) => izvuciKolacic(request.headers.get("cookie"));

/** @param {unknown} vrijednost @returns {Record<string, unknown>} */
export function kaoZapis(vrijednost) {
  if (!vrijednost || typeof vrijednost !== "object" || Array.isArray(vrijednost)) return {};
  return /** @type {Record<string, unknown>} */ (vrijednost);
}

/**
 * Mutations come only from this app's own pages: JSON (so a cross-site form
 * cannot send one without a preflight) and, where the browser says so, from
 * the same origin. SameSite=Strict on the cookie is the other half.
 * @param {Request} request
 * @returns {Promise<{tijelo: Record<string, unknown>} | {odbijeno: Response}>}
 */
export async function procitajMutaciju(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return { odbijeno: odgovor({ greska: "zabranjeno" }, 403) };
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return { odbijeno: odgovor({ greska: "ocekuje_se_json" }, 415) };
  }
  const bajtovi = await procitajOgranicenoTijelo(request, MAX_TIJELO);
  if (bajtovi === null) return { odbijeno: odgovor({ greska: "prevelik_zahtjev" }, 413) };
  try {
    return { tijelo: kaoZapis(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bajtovi))) };
  } catch {
    return { odbijeno: odgovor({ greska: "neispravan_json" }, 400) };
  }
}

const DULJINA = /^\d{1,9}$/;

/**
 * The body as bytes, or null when it is (or claims to be) larger than `max`
 * bytes; after ductura/Aplication_server lib/ograniceno-tijelo.js. A malformed
 * or too large Content-Length is refused before a byte is read; otherwise the
 * stream is counted and cancelled as soon as it passes `max`, so at most `max`
 * plus one chunk is held in memory. A stream error is passed on to the caller.
 * @param {Request} request
 * @param {number} max
 * @returns {Promise<Buffer | null>}
 */
export async function procitajOgranicenoTijelo(request, max) {
  const duljina = request.headers.get("content-length");
  if (duljina !== null && !(DULJINA.test(duljina) && Number(duljina) <= max)) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  /** @type {Uint8Array[]} */
  const dijelovi = [];
  let ukupno = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    ukupno += value.byteLength;
    if (ukupno > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    dijelovi.push(value);
  }
  return Buffer.concat(dijelovi, ukupno);
}

export const nedozvoljeno = (allow) => () =>
  new Response(null, { status: 405, headers: { ...NO_STORE, Allow: allow } });
