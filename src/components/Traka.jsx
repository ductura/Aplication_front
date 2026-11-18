import { hr } from "../i18n/hr.js";
import Odjava from "./Odjava.jsx";
import ui from "./ui.module.css";

export default function Traka({ admin }) {
  const ime = typeof admin?.korisnickoIme === "string" ? admin.korisnickoIme : null;
  return (
    <header className={ui.traka}>
      <span className={ui.ime}>{hr.app.name}</span>
      {admin && (
        <span className={ui.trakaDesno}>
          {ime && <span className={ui.tiho}>{hr.traka.prijavljen(ime)}</span>}
          <Odjava />
        </span>
      )}
    </header>
  );
}
