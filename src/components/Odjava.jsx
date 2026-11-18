"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hr } from "../i18n/hr.js";
import { api } from "../lib/putanje.js";
import ui from "./ui.module.css";

export default function Odjava() {
  const router = useRouter();
  const [saljem, setSaljem] = useState(false);

  async function odjavi() {
    setSaljem(true);
    await fetch(api("/odjava"), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(
      () => null,
    );
    router.replace("/prijava");
    router.refresh();
  }

  return (
    <button type="button" className={ui.sekundarniTamni} onClick={odjavi} disabled={saljem}>
      {saljem ? hr.traka.odjavljujem : hr.traka.odjava}
    </button>
  );
}
