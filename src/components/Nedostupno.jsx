import { hr } from "../i18n/hr.js";
import { BASE_PATH } from "../lib/putanje.js";
import Traka from "./Traka.jsx";
import ui from "./ui.module.css";

// Shown when Aplication_server does not answer; no data is guessed.
export default function Nedostupno({ admin = null, povratak = `${BASE_PATH}/` }) {
  return (
    <>
      <Traka admin={admin} />
      <main>
        <section className={`sheet ${ui.list}`} data-sheet-theme="light">
          <h1>{hr.app.name}</h1>
          <p className={ui.greska} role="alert">
            {hr.greske.nedostupan}
          </p>
          <a className={ui.poveznica} href={povratak}>
            {hr.greske.pokusajPonovno}
          </a>
        </section>
      </main>
    </>
  );
}
