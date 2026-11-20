import Link from "next/link";
import { redirect } from "next/navigation";
import Nedostupno from "../../../src/components/Nedostupno.jsx";
import Osvjezavanje from "../../../src/components/Osvjezavanje.jsx";
import StanjeInstance from "../../../src/components/StanjeInstance.jsx";
import Traka from "../../../src/components/Traka.jsx";
import ui from "../../../src/components/ui.module.css";
import { hr } from "../../../src/i18n/hr.js";
import { U_TIJEKU, ULOGE } from "../../../src/lib/institucija.js";
import { dohvatiInstitucije, dohvatiSesiju } from "../../../src/server/podaci.js";
import styles from "../../page.module.css";

const STANJE_GRESKA = "greska";
const STANJE_U_IZRADI = "u_izradi";
export const dynamic = "force-dynamic";

const t = hr.instanca;
const vrijeme = (v) => (v ? new Date(v).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb" }) : "—");

export default async function Institucija({ params }) {
  const { id } = await params;
  const sesija = await dohvatiSesiju();
  if (sesija.stanje === "odjavljen") redirect("/prijava");
  if (sesija.stanje === "nedostupan") return <Nedostupno />;
  const institucije = await dohvatiInstitucije();
  if (institucije === "odjavljen") redirect("/prijava");
  if (institucije === "nedostupan") return <Nedostupno admin={sesija.admin} />;
  const i = institucije.find((x) => x.id === id);
  const p = i?.provisioning ?? {};
  const stanje = p.stanje;
  const pokusaja = Number.isSafeInteger(p.pokusaja) ? p.pokusaja : null;

  return (
    <>
      <Traka admin={sesija.admin} />
      <main>
        <section className={`sheet ${styles.sheet} ${ui.list}`} data-sheet-theme="light">
          <p>
            <Link className={ui.poveznica} href="/">
              {t.natrag}
            </Link>
          </p>
          {!i ? (
            <h1>{t.nema}</h1>
          ) : (
            <>
              <h1>{i.naziv}</h1>
              <h2>{t.stanje}</h2>
              <p className={ui.stanjeRed} role="status">
                <StanjeInstance stanje={stanje} /> <span>{t.opis[stanje] ?? ""}</span>
              </p>
              {stanje === STANJE_GRESKA && (
                <p className={ui.greska}>{t.kodovi[p.kodGreske] ?? t.kodovi.neispravan_unos}</p>
              )}
              {stanje === STANJE_U_IZRADI && p.zadnjaGreska && pokusaja > 0 && (
                <p className={ui.pomoc}>{t.neuspjeliPokusaj(pokusaja)}</p>
              )}
              {U_TIJEKU.includes(stanje) && (
                <>
                  <p className={ui.pomoc}>{t.osvjezava}</p>
                  <Osvjezavanje />
                </>
              )}
              <h2>{t.podaci}</h2>
              <dl className={ui.podaci}>
                <dt>{t.slug}</dt>
                <dd>{i.slug}</dd>
                <dt>{t.domena}</dt>
                <dd>{i.aaiDomena}</dd>
                <dt>{t.issuer}</dt>
                <dd>{i.issuer}</dd>
                <dt>{t.zatrazeno}</dt>
                <dd>{vrijeme(p.zatrazeno)}</dd>
                <dt>{t.aktivirano}</dt>
                <dd>{vrijeme(p.aktivirano)}</dd>
                {pokusaja !== null && (
                  <>
                    <dt>{t.pokusaja}</dt>
                    <dd>{pokusaja}</dd>
                  </>
                )}
              </dl>
              <h2>{t.racuni}</h2>
              <dl className={ui.podaci}>
                {ULOGE.map(([u]) => (
                  <div key={u} className={ui.par}>
                    <dt>{hr.obrazac.uloge[u]}</dt>
                    <dd>{Number(i.racuni?.[u] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
              <p className={ui.napomena}>{hr.obrazac.napomena}</p>
            </>
          )}
        </section>
      </main>
    </>
  );
}
