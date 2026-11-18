"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { hr } from "../i18n/hr.js";
import { predloziDomenu, provjeriUnos, ULOGE } from "../lib/institucija.js";
import { api } from "../lib/putanje.js";
import ui from "./ui.module.css";

const t = hr.obrazac;
const POCETNI = { student: "0", teacher: "0", network_engineer: "0", institution_admin: "1" };
const REDOSLIJED = ["fakultetId", "aaiDomena", ...ULOGE.map(([u]) => `racuni.${u}`)];

// Error code per field (src/lib/institucija.js and the BFF) -> text.
function tekstGreske(polje, kod) {
  if (polje === "fakultetId") {
    return { obavezno: t.greske.fakultetObavezan, zauzeto: t.greske.fakultetZauzet }[kod] ?? t.greske.fakultetNepoznat;
  }
  if (polje === "aaiDomena") {
    return { obavezno: t.greske.domenaObavezna, zauzeto: t.greske.domenaZauzeta }[kod] ?? t.greske.domenaNeispravna;
  }
  const [, min, max] = ULOGE.find(([u]) => `racuni.${u}` === polje) ?? [];
  return t.greske.broj(min, max);
}

const idPolja = (polje) => polje.replace(".", "-");

export default function DodajInstituciju({ fakulteti, institucije }) {
  const router = useRouter();
  const [otvoren, setOtvoren] = useState(false);
  const [fakultetId, setFakultetId] = useState("");
  const [aaiDomena, setAaiDomena] = useState("");
  const [predlozena, setPredlozena] = useState("");
  const [racuni, setRacuni] = useState(POCETNI);
  const [greske, setGreske] = useState({});
  const [opca, setOpca] = useState("");
  const [saljem, setSaljem] = useState(false);
  const obrazacRef = useRef(null);
  const gumbRef = useRef(null);

  const zauzeti = new Set(institucije.map((i) => i.fakultetId));

  function fokusirajPrvu(polja) {
    const prvo = REDOSLIJED.find((p) => polja[p]);
    if (prvo) obrazacRef.current?.querySelector(`#${idPolja(prvo)}`)?.focus();
  }

  function odaberiFakultet(id) {
    setFakultetId(id);
    const prijedlog = predloziDomenu(fakulteti.find((f) => f.id === id)?.web);
    // Only replace a domain the admin has not typed.
    if (!aaiDomena || aaiDomena === predlozena) setAaiDomena(prijedlog);
    setPredlozena(prijedlog);
  }

  function zatvori() {
    setOtvoren(false);
    setGreske({});
    setOpca("");
    requestAnimationFrame(() => gumbRef.current?.focus());
  }

  async function posalji(e) {
    e.preventDefault();
    const brojevi = Object.fromEntries(
      ULOGE.map(([u]) => [u, /^\d{1,6}$/.test(racuni[u].trim()) ? Number(racuni[u].trim()) : Number.NaN]),
    );
    const unos = { fakultetId, aaiDomena, racuni: brojevi };
    const lokalne = provjeriUnos(unos);
    setOpca("");
    setGreske(lokalne);
    if (Object.keys(lokalne).length) return fokusirajPrvu(lokalne);

    setSaljem(true);
    try {
      const res = await fetch(api("/institucije"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(unos),
      });
      const tijelo = await res.json().catch(() => ({}));
      if (res.status === 201 && typeof tijelo.institucija?.id === "string") {
        router.push(`/institucije/${encodeURIComponent(tijelo.institucija.id)}`);
        return;
      }
      if (res.status === 401) {
        router.replace("/prijava");
        return;
      }
      const polja = tijelo.polja && typeof tijelo.polja === "object" ? tijelo.polja : {};
      setGreske(polja);
      if (Object.keys(polja).length) fokusirajPrvu(polja);
      else setOpca({ zauzeto: t.greske.zauzeto, neispravan_unos: t.greske.neispravno, issuer: t.greske.issuer }[tijelo.greska] ?? hr.greske.nedostupan);
      if (res.status === 409) router.refresh();
    } catch {
      setOpca(hr.greske.nedostupan);
    }
    setSaljem(false);
  }

  const greskaZa = (polje) =>
    greske[polje] ? (
      <p id={`${idPolja(polje)}-greska`} className={ui.greska}>
        {tekstGreske(polje, greske[polje])}
      </p>
    ) : null;
  const opis = (polje, pomoc) =>
    [pomoc, greske[polje] && `${idPolja(polje)}-greska`].filter(Boolean).join(" ") || undefined;

  if (!otvoren) {
    return (
      <button
        ref={gumbRef}
        type="button"
        className={ui.primarni}
        aria-expanded="false"
        aria-controls="nova-institucija"
        onClick={() => {
          setOtvoren(true);
          requestAnimationFrame(() => document.getElementById("fakultetId")?.focus());
        }}
      >
        {hr.institucije.dodaj}
      </button>
    );
  }

  return (
    <section id="nova-institucija" className={ui.okvir} aria-labelledby="nova-institucija-naslov">
      <h2 id="nova-institucija-naslov">{t.naslov}</h2>
      {fakulteti === null ? (
        <>
          <p className={ui.greska} role="alert">
            {t.bezFakulteta}
          </p>
          <div className={ui.radnje}>
            <button type="button" className={ui.sekundarni} onClick={zatvori}>
              {t.odustani}
            </button>
          </div>
        </>
      ) : (
        <form method="post" ref={obrazacRef} className={ui.obrazac} onSubmit={posalji} noValidate>
          <div className={ui.polje}>
            <label htmlFor="fakultetId">{t.fakultet}</label>
            <select
              id="fakultetId"
              name="fakultetId"
              value={fakultetId}
              onChange={(e) => odaberiFakultet(e.target.value)}
              aria-invalid={greske.fakultetId ? "true" : undefined}
              aria-describedby={opis("fakultetId")}
              required
            >
              <option value="">{t.odaberi}</option>
              {fakulteti.map((f) => (
                <option key={f.id} value={f.id} disabled={zauzeti.has(f.id)}>
                  {zauzeti.has(f.id) ? t.vecDodan(f.naziv) : f.naziv}
                </option>
              ))}
            </select>
            {greskaZa("fakultetId")}
          </div>

          <div className={ui.polje}>
            <label htmlFor="aaiDomena">{t.domena}</label>
            <input
              id="aaiDomena"
              name="aaiDomena"
              value={aaiDomena}
              onChange={(e) => setAaiDomena(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={253}
              aria-invalid={greske.aaiDomena ? "true" : undefined}
              aria-describedby={opis("aaiDomena", "aaiDomena-pomoc")}
              required
            />
            <p id="aaiDomena-pomoc" className={ui.pomoc}>
              {t.domenaPomoc}
            </p>
            {greskaZa("aaiDomena")}
          </div>

          <fieldset className={ui.skupina}>
            <legend>{t.racuni}</legend>
            <div className={ui.mreza}>
              {ULOGE.map(([uloga, min, max]) => {
                const polje = `racuni.${uloga}`;
                return (
                  <div className={ui.polje} key={uloga}>
                    <label htmlFor={idPolja(polje)}>{t.uloge[uloga]}</label>
                    <input
                      id={idPolja(polje)}
                      name={polje}
                      type="number"
                      inputMode="numeric"
                      min={min}
                      max={max}
                      step={1}
                      value={racuni[uloga]}
                      onChange={(e) => setRacuni((r) => ({ ...r, [uloga]: e.target.value }))}
                      aria-invalid={greske[polje] ? "true" : undefined}
                      aria-describedby={opis(polje)}
                      required
                    />
                    {greskaZa(polje)}
                  </div>
                );
              })}
            </div>
            <p className={ui.napomena}>{t.napomena}</p>
          </fieldset>

          <p className={ui.greska} role="alert">
            {opca}
          </p>
          <div className={ui.radnje}>
            <button className={ui.primarni} type="submit" disabled={saljem}>
              {saljem ? t.saljem : t.posalji}
            </button>
            <button type="button" className={ui.sekundarni} onClick={zatvori} disabled={saljem}>
              {t.odustani}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
