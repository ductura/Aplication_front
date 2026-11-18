import Link from "next/link";
import { hr } from "../src/i18n/hr.js";
import styles from "./page.module.css";

export default function NotFound() {
  return (
    <main>
      <section className={`sheet ${styles.sheet}`} data-sheet-theme="light">
        <h1>{hr.notFound.heading}</h1>
        <Link href="/">{hr.notFound.back}</Link>
      </section>
    </main>
  );
}
