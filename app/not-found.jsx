import Link from "next/link";
import ui from "../src/components/ui.module.css";
import { hr } from "../src/i18n/hr.js";
import styles from "./page.module.css";

export default function NotFound() {
  return (
    <main>
      <section className={`sheet ${styles.sheet} ${ui.list}`} data-sheet-theme="light">
        <h1>{hr.notFound.naslov}</h1>
        <Link className={ui.poveznica} href="/">
          {hr.notFound.natrag}
        </Link>
      </section>
    </main>
  );
}
