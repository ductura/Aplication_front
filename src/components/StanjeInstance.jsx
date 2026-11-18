import { hr } from "../i18n/hr.js";
import ui from "./ui.module.css";

export default function StanjeInstance({ stanje }) {
  const tekst = hr.instanca.stanja[stanje] ?? stanje ?? "";
  return (
    <span className={ui.stanje} data-stanje={stanje}>
      {tekst}
    </span>
  );
}
