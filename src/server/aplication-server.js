// The only way this app reaches Aplication_server. Runs on the server (route
// handlers and server components); the browser never calls it directly. The
// admin session cookie `ductura_admin` is passed through in both directions
// and nothing else is.
export const KOLACIC = "ductura_admin";
const ZADANI_URL = "http://127.0.0.1:3110";
const ROK_MS = 5_000;

export const serverUrl = () => (process.env.APLICATION_SERVER_URL || ZADANI_URL).replace(/\/+$/, "");

/** Value of ductura_admin from a Cookie header, or null. */
export function izvuciKolacic(cookieHeader) {
  for (const dio of String(cookieHeader ?? "").split(";")) {
    const i = dio.indexOf("=");
    if (i < 0 || dio.slice(0, i).trim() !== KOLACIC) continue;
    const v = dio.slice(i + 1).trim();
    return /^[!#-+\--:<-[\]-~]{1,4096}$/.test(v) ? v : null;
  }
  return null;
}

/** Set-Cookie lines from a server answer that concern ductura_admin only. */
export function kolaciciZaPreglednik(odgovor) {
  return odgovor.headers.getSetCookie().filter((c) => c.trimStart().startsWith(`${KOLACIC}=`));
}

export const obrisiKolacic = () => `${KOLACIC}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;

/**
 * @param {string} putanja e.g. "/api/admin/ja"
 * @param {{method?: string, tijelo?: unknown, kolacic?: string | null}} [opcije]
 * @returns {Promise<Response | null>} null when the server cannot be reached in time.
 */
export async function pozoviServer(putanja, { method = "GET", tijelo, kolacic } = {}) {
  const headers = { accept: "application/json" };
  if (kolacic) headers.cookie = `${KOLACIC}=${kolacic}`;
  if (tijelo !== undefined) headers["content-type"] = "application/json";
  try {
    return await fetch(`${serverUrl()}${putanja}`, {
      method,
      headers,
      body: tijelo === undefined ? undefined : JSON.stringify(tijelo),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(ROK_MS),
    });
  } catch {
    return null;
  }
}

/** JSON body of an answer, or null when it is not JSON. */
export async function procitajJson(odgovor) {
  try {
    return await odgovor.json();
  } catch {
    return null;
  }
}
