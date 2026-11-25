import { describe, expect, it } from "vitest";
import { findForbidden } from "../scripts/checks/forbidden-terms.mjs";
import * as catalog from "../src/i18n/hr.js";

// Catalogue entries may be message functions; the scanner stays strict, so expand them with sample
// arguments (a name, and 0/1/5 for counts) and scan every rendered result.
const SAMPLES = [["Ime Prezime"], [0, 5], [1, 100000], [5, 12]];
const expand = (v) => {
  if (typeof v === "function") return Object.fromEntries(SAMPLES.map((a, i) => [`call${i}`, v(...a)]));
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expand(x)]));
  return v;
};

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
    "40 % ljudskog teksta", "Podrijetlo: 60 %", "izvor 30 %", "40 % teksta je AI", "AI-generirano 40 %", "AI40%",
    "plagiat", "udjel AI", "skrivanje", "nedostaje podataka", "nestalo podataka", "upozorenje za studenta",
    "neizvorno", "\u0455umnjiv\u043e", "\ua731umnjivo", "su\u0359mnjivo",
  ])("reports %s", (text) => {
    expect(hit(text)).toEqual([expect.objectContaining({ key: "a.b" })]);
  });

  it.each([
    "Kopiraj navod", "Kopirano u međuspremnik", "Copy citation", "Sakrij popis", "nepravilan format", "izvorni naziv",
    "nije dokaz autorstva", "Izjava o autorstvu", "Preuzmi", "Učitavanje 40 %", "tuđi", "Spremljeno na poslužitelju",
    "spremljena na uređaju", "Nedostaje naziv", "Izgubljena veza", "Integracija", "Spremi", "sprema se",
    "Neispravan broj", "asterisk", "Authentication", "Dodaj instituciju", "Broj računa za studente",
    "Spremljene promjene na poslužitelju", "Najviše 100000 računa", "Izvor: Ductura",
  ])("allows %s", (text) => {
    expect(hit(text)).toEqual([]);
  });

  it("reports a letter outside the allowed scripts even when its other case is inside them", () => {
    expect(hit("suɲjivo")).not.toEqual([]);
    expect(hit("ɲ")).not.toEqual([]);
    expect(hit("Ž, č, ć, đ, š, ž, dž, Ü, ß")).toEqual([]);
  });

  // Separators and invisible characters inside a term are findings themselves, never folded into a word break.
  const INSERTED = [
    " ", " ", "⠀", "　", "", "\u{f0000}", "͸", "·", "‧", "•", "️",
    "̲", "­", "​", "‍", "⁠", "͏", "ㅤ", "\u{e0041}", "\u{1d173}", "\t", "\n", "_", "~",
  ];
  it.each(INSERTED.map((c) => [`U+${c.codePointAt(0).toString(16).toUpperCase()}`, c]))("reports %s inside a word", (_, c) => {
    expect(hit(`sumn${c}jivo`)).not.toEqual([]);
    expect(hit(`Dodaj${c}instituciju`)).not.toEqual([]);
  });

  it("accepts every character the UI text set allows", () => {
    expect(hit("Dodaj: (a) [b] - – — … / % + = & @ # * « » „x“ ”y” ‘z’ ← → ↑ ↓ 40 % ! ? ; , . ' \"")).toEqual([]);
    expect(hit("Učitavanje".normalize("NFD"))).toEqual([]);
  });

  it("walks arrays and reports values that are not text, plain objects or arrays", () => {
    const value = { l: ["ok", "rizik"], n: 1, f: null, fn: () => "x", m: new Map(), s: new String("x"), d: new Date() };
    expect(findForbidden(value).map((x) => x.key).sort()).toEqual(["d", "f", "fn", "l.1", "m", "n", "s"]);
  });

  it("every export of the real catalogue is clean", () => {
    expect(Object.keys(catalog)).not.toEqual([]);
    expect(findForbidden(expand({ ...catalog }))).toEqual([]);
  });
});
