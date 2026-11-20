import { redirect } from "next/navigation";
import ObrazacPrijave from "../../src/components/ObrazacPrijave.jsx";
import Traka from "../../src/components/Traka.jsx";
import ui from "../../src/components/ui.module.css";
import { hr } from "../../src/i18n/hr.js";
import { dohvatiSesiju } from "../../src/server/podaci.js";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";
const RAZDJELNIK = " · ";
export const metadata = { title: [hr.prijava.naslov, hr.app.name].join(RAZDJELNIK) };

export default async function Prijava() {
  if ((await dohvatiSesiju()).stanje === "prijavljen") redirect("/");
  return (
    <>
      <Traka admin={null} />
      <main>
        <section className={`sheet ${styles.sheet} ${ui.list} ${ui.uzak}`} data-sheet-theme="light">
          <h1>{hr.prijava.naslov}</h1>
          <p>{hr.prijava.uvod}</p>
          <ObrazacPrijave />
        </section>
      </main>
    </>
  );
}
