"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hr } from "../i18n/hr.js";
import { api } from "../lib/putanje.js";
import ui from "./ui.module.css";

const t = hr.ponovi;

/**
 * Sends the retry through the BFF. Same origin, JSON.
 * @returns {Promise<"ok" | "prijava" | "nema" | "nije_ponovljivo" | "nedostupan" | "opce">}
 */
export async function posaljiPonovi(id, dohvati = fetch) {
  try {
    const res = await dohvati(api(`/institucije/${encodeURIComponent(id)}/ponovi`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      credentials: "same-origin",
    });
    if (res.status === 200) return "ok";
    if (res.status === 401) return "prijava";
    if (res.status === 404) return "nema";
    if (res.status === 409) return "nije_ponovljivo";
    if (res.status === 502 || res.status === 503) return "nedostupan";
    return "opce";
  } catch {
    return "nedostupan";
  }
}

// Shown only while the instance is zatrazena or u_izradi (the page decides).
export default function PonoviPokusaj({ id }) {
  const router = useRouter();
  const [saljem, postaviSaljem] = useState(false);
  const [greska, postaviGresku] = useState(null);

  async function klik() {
    postaviSaljem(true);
    postaviGresku(null);
    const ishod = await posaljiPonovi(id);
    if (ishod === "prijava") return router.replace("/prijava");
    postaviSaljem(false);
    if (ishod === "ok") return router.refresh();
    postaviGresku(ishod);
    if (ishod === "nije_ponovljivo") router.refresh();
  }

  return (
    <div className={ui.dodaj}>
      <button type="button" className={ui.primarni} onClick={klik} disabled={saljem}>
        {saljem ? t.saljem : t.gumb}
      </button>
      <p className={ui.pomoc}>{t.pomoc}</p>
      {greska && (
        <p className={ui.greska} role="alert">
          {t.greske[greska] ?? t.greske.opce}
        </p>
      )}
    </div>
  );
}
