"use client";

import { hr } from "../src/i18n/hr.js";
import "./globals.css";
import styles from "./page.module.css";

// Replaces the root layout on an unrecoverable error; never shows error details.
export default function GlobalError({ retry }) {
  return (
    <html lang="hr">
      <body>
        <main className={`sheet ${styles.sheet}`} data-sheet-theme="light">
          <h1>{hr.error.heading}</h1>
          <button type="button" onClick={() => retry?.()}>
            {hr.error.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
