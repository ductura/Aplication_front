import { hr } from "../src/i18n/hr.js";
import styles from "./page.module.css";

export default function Page() {
  return (
    <>
      <header className={styles.bar}>{hr.app.name}</header>
      <main>
        <section className={`sheet ${styles.sheet}`} data-sheet-theme="light">
          <h1>{hr.home.heading}</h1>
          <p>{hr.home.lead}</p>
        </section>
      </main>
    </>
  );
}
