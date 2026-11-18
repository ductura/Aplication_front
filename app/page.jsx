import Link from "next/link";
import { redirect } from "next/navigation";
import DodajInstituciju from "../src/components/DodajInstituciju.jsx";
import Nedostupno from "../src/components/Nedostupno.jsx";
import StanjeInstance from "../src/components/StanjeInstance.jsx";
import Traka from "../src/components/Traka.jsx";
import ui from "../src/components/ui.module.css";
import { hr } from "../src/i18n/hr.js";
import { ULOGE } from "../src/lib/institucija.js";
import { dohvatiFakultete, dohvatiInstitucije, dohvatiSesiju } from "../src/server/podaci.js";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const t = hr.institucije;

export default async function Page() {
  const sesija = await dohvatiSesiju();
  if (sesija.stanje === "odjavljen") redirect("/prijava");
  if (sesija.stanje === "nedostupan") return <Nedostupno />;
  const [institucije, fakulteti] = await Promise.all([dohvatiInstitucije(), dohvatiFakultete()]);
  if (institucije === "odjavljen") redirect("/prijava");
  if (institucije === "nedostupan") return <Nedostupno admin={sesija.admin} />;

  return (
    <>
      <Traka admin={sesija.admin} />
      <main>
        <section className={`sheet ${styles.sheet} ${styles.siroko} ${ui.list}`} data-sheet-theme="light">
          <h1>{hr.home.heading}</h1>
          <p>{hr.home.lead}</p>
          <h2>{t.naslov}</h2>
          {institucije.length === 0 ? (
            <p>{t.prazno}</p>
          ) : (
            <div className={ui.tablicaOkvir} tabIndex={0} role="region" aria-label={t.opisTablice}>
              <table className={ui.tablica}>
                <caption className={ui.zaCitac}>{t.opisTablice}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.stupci.naziv}</th>
                    <th scope="col">{t.stupci.domena}</th>
                    {ULOGE.map(([u]) => (
                      <th scope="col" key={u} className={ui.broj}>
                        {t.stupci[u]}
                      </th>
                    ))}
                    <th scope="col">{t.stupci.stanje}</th>
                  </tr>
                </thead>
                <tbody>
                  {institucije.map((i) => (
                    <tr key={i.id}>
                      <th scope="row">
                        <Link className={ui.poveznica} href={`/institucije/${encodeURIComponent(i.id)}`}>
                          {i.naziv}
                        </Link>
                      </th>
                      <td>{i.aaiDomena}</td>
                      {ULOGE.map(([u]) => (
                        <td key={u} className={ui.broj}>
                          {Number(i.racuni?.[u] ?? 0)}
                        </td>
                      ))}
                      <td>
                        <StanjeInstance stanje={i.provisioning?.stanje} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={ui.dodaj}>
            <DodajInstituciju fakulteti={fakulteti} institucije={institucije} />
          </div>
        </section>
      </main>
    </>
  );
}
