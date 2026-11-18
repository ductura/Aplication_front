import { describe, expect, it } from "vitest";
import { findForbidden } from "../scripts/checks/forbidden-terms.mjs";
import { hr } from "../src/i18n/hr.js";

const hit = (text) => findForbidden({ a: { b: text } });

describe("forbidden terms scanner (PRODUCT.md §5, D-276)", () => {
  it.each([
    ["exact", "Sumnjivo"], ["inflected", "Nema sumnjivog unosa"], ["compound", "vjerojatnost"],
    ["plagiarism", "plagiranje"], ["upper case", "RIZIK"], ["no diacritics", "autenticnost"],
    ["no diacritics phrase", "tudi tekst"], ["dj spelling", "tudji tekst"], ["English", "Suspicious entry"],
    ["English score", "risk score"], ["English flagged", "Flagged for review"], ["multi-word", "dokaz  autorstva"],
    ["hyphenated", "copy-paste"], ["in a sentence", "Ovo je neobično dug naziv."],
    ["reversed order AI", "AI je napisao odlomak"], ["reversed order data", "podaci su nestali"],
    ["missing data phrase", "Nedostajući podaci"], ["percent next to AI", "40 % AI"], ["AI share", "udio AI-ja"],
    ["NFD marks", "autentícnost".normalize("NFD")], ["soft hyphen", "sum­njivo"],
    ["zero width", "plagi​jat"], ["NBSP phrase", "dokaz autorstva"],
    ["saved without place", "Institucija je spremljena."], ["irregular", "Nepravilna adresa"],
    ["allow masks only its own span", "Kopiraj navod — kopirano"],
  ])("reports %s", (_, text) => {
    expect(hit(text)).toEqual([expect.objectContaining({ key: "a.b" })]);
  });

  it.each([
    "Kopiraj navod", "Kopirano u međuspremnik", "Copy citation", "Sakrij popis", "nepravilan format",
    "izvorni naziv", "nije dokaz autorstva", "Izjava o autorstvu", "Preuzmi", "Učitavanje 40 %", "tuđi",
    "Spremljeno na poslužitelju", "spremljena na uređaju", "Nedostaje naziv", "Izgubljena veza",
    "Integracija", "Spremi", "sprema se", "Neispravan broj", "asterisk", "Authentication", "Dodaj instituciju",
  ])("allows %s", (text) => {
    expect(hit(text)).toEqual([]);
  });

  it("walks arrays and reports values that are not text", () => {
    const keys = findForbidden({ l: ["ok", "rizik"], n: 1, f: null, fn: () => "rizik" }).map((x) => x.key);
    expect(keys.sort()).toEqual(["f", "fn", "l.1", "n"]);
  });

  it("the real catalogue is clean", () => {
    expect(findForbidden(hr)).toEqual([]);
  });
});
