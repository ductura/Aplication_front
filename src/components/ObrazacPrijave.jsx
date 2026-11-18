"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { hr } from "../i18n/hr.js";
import { api } from "../lib/putanje.js";
import ui from "./ui.module.css";

const t = hr.prijava;
const bezPretplate = () => () => {};

export default function ObrazacPrijave() {
  const router = useRouter();
  const [greska, setGreska] = useState("");
  const [saljem, setSaljem] = useState(false);
  const imeRef = useRef(null);
  // Until hydration the button stays disabled, so the browser can never send
  // the form natively (a GET would put the password into the URL).
  const spreman = useSyncExternalStore(bezPretplate, () => true, () => false);

  async function posalji(e) {
    e.preventDefault();
    const podaci = new FormData(e.currentTarget);
    const korisnickoIme = String(podaci.get("korisnickoIme") ?? "");
    const lozinka = String(podaci.get("lozinka") ?? "");
    if (!korisnickoIme.trim() || !lozinka) {
      setGreska(t.obavezno);
      imeRef.current?.focus();
      return;
    }
    setSaljem(true);
    setGreska("");
    try {
      const res = await fetch(api("/prijava"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ korisnickoIme, lozinka }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const tijelo = await res.json().catch(() => ({}));
      if (res.status === 401) setGreska(t.pogresno);
      else if (res.status === 429) setGreska(t.previse(tijelo.nakonSekundi ? Math.ceil(tijelo.nakonSekundi / 60) : null));
      else setGreska(hr.greske.nedostupan);
    } catch {
      setGreska(hr.greske.nedostupan);
    }
    setSaljem(false);
  }

  return (
    <form method="post" className={ui.obrazac} onSubmit={posalji} noValidate aria-describedby={greska ? "prijava-greska" : undefined}>
      <div className={ui.polje}>
        <label htmlFor="korisnickoIme">{t.korisnickoIme}</label>
        <input ref={imeRef} id="korisnickoIme" name="korisnickoIme" autoComplete="username" required maxLength={256} />
      </div>
      <div className={ui.polje}>
        <label htmlFor="lozinka">{t.lozinka}</label>
        <input id="lozinka" name="lozinka" type="password" autoComplete="current-password" required maxLength={256} />
      </div>
      <p id="prijava-greska" className={ui.greska} role="alert">
        {greska}
      </p>
      <div className={ui.radnje}>
        <button className={ui.primarni} type="submit" disabled={saljem || !spreman}>
          {saljem ? t.saljem : t.posalji}
        </button>
      </div>
    </form>
  );
}
