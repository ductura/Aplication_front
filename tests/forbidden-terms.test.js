import { describe, expect, it } from "vitest";
import { findForbidden } from "../scripts/checks/forbidden-terms.mjs";
import * as catalog from "../src/i18n/hr.js";

const hit = (text) => findForbidden({ a: { b: text } });

describe("forbidden terms scanner (PRODUCT.md §5, D-276)", () => {
  it.each([
    "Sumnjivo", "Nema sumnjivog unosa", "vjerojatnost", "vjerojatan izvor", "autentičan tekst", "neobičan unos",
    "Nepravilan rad studenta", "neoriginalan rad", "plagiranje", "niskorizičan", "bezrizično", "osumnjičeni student",
    "posumnjati", "prekopiran tekst", "iskopirano", "neautentično", "neizvornost", "antiplagijat", "prikrivanje",
    "RIZIK", "autenticnost", "tudi tekst", "tudji tekst", "Suspicious entry", "risk score", "Flagged for review",
    "copy-pasted", "copy/paste", "dokaz  autorstva", "AI je napisao odlomak", "podaci su nestali", "nedostaju podaci",
    "Nedostajući podaci", "40 % AI", "40 posto AI", "AI: 40 %", "AI-ja 40 %", "AI udio", "udio AI-ja",
    "autentícnost".normalize("NFD"), "sum­njivo", "plagi​jat", "rizi‎k", "sumn⁣jivo",
    "dokaz autorstva", "Ovo je neobično dug naziv.", "Institucija je spremljena.", "Kopiraj navod — kopirano",
  ])("reports %s", (text) => {
    expect(hit(text)).toEqual([expect.objectContaining({ key: "a.b" })]);
  });

  it.each([
    "Kopiraj navod", "Kopirano u međuspremnik", "Copy citation", "Sakrij popis", "nepravilan format", "izvorni naziv",
    "nije dokaz autorstva", "Izjava o autorstvu", "Preuzmi", "Učitavanje 40 %", "tuđi", "Spremljeno na poslužitelju",
    "spremljena na uređaju", "Nedostaje naziv", "Izgubljena veza", "Integracija", "Spremi", "sprema se",
    "Neispravan broj", "asterisk", "Authentication", "Dodaj instituciju", "Broj računa za studente",
  ])("allows %s", (text) => {
    expect(hit(text)).toEqual([]);
  });

  it("walks arrays and reports values that are not text, plain objects or arrays", () => {
    const value = { l: ["ok", "rizik"], n: 1, f: null, fn: () => "x", m: new Map(), s: new String("x"), d: new Date() };
    expect(findForbidden(value).map((x) => x.key).sort()).toEqual(["d", "f", "fn", "l.1", "m", "n", "s"]);
  });

  it("every export of the real catalogue is clean", () => {
    expect(Object.keys(catalog)).not.toEqual([]);
    expect(findForbidden({ ...catalog })).toEqual([]);
  });
});
