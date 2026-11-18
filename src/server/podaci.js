// Data for server components. Every read carries the admin cookie of the
// current request; a 401 from the server means the session is gone.
import { cookies } from "next/headers";
import { KOLACIC, pozoviServer, procitajJson } from "./aplication-server.js";

async function kolacic() {
  return (await cookies()).get(KOLACIC)?.value ?? null;
}

/** @returns {Promise<{stanje: "prijavljen", admin: object} | {stanje: "odjavljen"} | {stanje: "nedostupan"}>} */
export async function dohvatiSesiju() {
  const k = await kolacic();
  if (!k) return { stanje: "odjavljen" };
  const res = await pozoviServer("/api/admin/ja", { kolacic: k });
  if (!res) return { stanje: "nedostupan" };
  if (res.status === 401) return { stanje: "odjavljen" };
  if (!res.ok) return { stanje: "nedostupan" };
  const admin = await procitajJson(res);
  return { stanje: "prijavljen", admin: admin && typeof admin === "object" ? admin : {} };
}

// "odjavljen" | "nedostupan" | the parsed body.
async function citaj(putanja) {
  const res = await pozoviServer(putanja, { kolacic: await kolacic() });
  if (!res) return "nedostupan";
  if (res.status === 401) return "odjavljen";
  if (!res.ok) return "nedostupan";
  return (await procitajJson(res)) ?? "nedostupan";
}

export async function dohvatiInstitucije() {
  const r = await citaj("/api/admin/institutions");
  if (typeof r === "string") return r;
  return Array.isArray(r.institucije) ? r.institucije : "nedostupan";
}

/** @returns {Promise<Array<{id: string, naziv: string, web?: string | null}> | null>} null when the list is unavailable. */
export async function dohvatiFakultete() {
  const r = await citaj("/api/admin/fakulteti");
  if (typeof r === "string" || !Array.isArray(r.fakulteti)) return null;
  return r.fakulteti.filter((f) => f && typeof f.id === "string" && typeof f.naziv === "string");
}
