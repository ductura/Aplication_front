import { hr } from "../i18n/hr.js";
import ui from "./ui.module.css";

const t = hr.povijest;

export const formatirajVrijeme = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("hr-HR", { timeZone: "Europe/Zagreb" });
};

// Newest first; entries that are not objects are dropped, nothing else is guessed.
const uredi = (pokusaji) =>
  (Array.isArray(pokusaji) ? pokusaji : [])
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      vrijeme: typeof p.vrijeme === "string" ? p.vrijeme : null,
      ishod: typeof p.ishod === "string" ? p.ishod : null,
      kod: typeof p.kodGreske === "string" && p.kodGreske ? p.kodGreske : null,
    }))
    .sort((a, b) => (Date.parse(b.vrijeme) || 0) - (Date.parse(a.vrijeme) || 0));

// History of attempts to start an instance: time, outcome, error code.
export default function PovijestPokusaja({ pokusaji }) {
  const redovi = uredi(pokusaji);
  if (!redovi.length) return <p className={ui.pomoc}>{t.prazno}</p>;
  return (
    <div className={ui.tablicaOkvir}>
      <table className={ui.tablica}>
        <caption className={ui.zaCitac}>{t.opisTablice}</caption>
        <thead>
          <tr>
            <th scope="col">{t.stupci.vrijeme}</th>
            <th scope="col">{t.stupci.ishod}</th>
            <th scope="col">{t.stupci.kod}</th>
          </tr>
        </thead>
        <tbody>
          {redovi.map((r, i) => (
            <tr key={i}>
              <td>{formatirajVrijeme(r.vrijeme)}</td>
              <td>{t.ishodi[r.ishod] ?? "—"}</td>
              <td>{r.kod ? <code>{r.kod}</code> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
