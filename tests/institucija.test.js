import { describe, expect, it } from "vitest";
import { greskaStvaranja, predloziDomenu, provjeriUnos } from "../src/lib/institucija.js";

const dobro = { fakultetId: "fpzg", aaiDomena: "fpzg.hr", racuni: { student: 200, teacher: 50, network_engineer: 3, institution_admin: 1 } };
const s = (racuni) => ({ ...dobro, racuni: { ...dobro.racuni, ...racuni } });

describe("provjeriUnos", () => {
  it("accepts the contract example and bounds", () => {
    expect(provjeriUnos(dobro)).toEqual({});
    expect(provjeriUnos(s({ student: 50_000, teacher: 5_000, network_engineer: 20, institution_admin: 20 }))).toEqual({});
    expect(provjeriUnos({ ...dobro, aaiDomena: "  FPZG.hr\n" })).toEqual({});
  });

  it.each([
    [{ ...dobro, fakultetId: "" }, { fakultetId: "obavezno" }],
    [{ ...dobro, aaiDomena: "  " }, { aaiDomena: "obavezno" }],
    [{ ...dobro, aaiDomena: "fpzg" }, { aaiDomena: "neispravno" }],
    [{ ...dobro, aaiDomena: "fp zg.hr" }, { aaiDomena: "neispravno" }],
    [{ ...dobro, aaiDomena: "-fpzg.hr" }, { aaiDomena: "neispravno" }],
    [s({ institution_admin: 0 }), { "racuni.institution_admin": "neispravno" }],
    [s({ institution_admin: 21 }), { "racuni.institution_admin": "neispravno" }],
    [s({ student: 50_001 }), { "racuni.student": "neispravno" }],
    [s({ teacher: -1 }), { "racuni.teacher": "neispravno" }],
    [s({ network_engineer: 1.5 }), { "racuni.network_engineer": "neispravno" }],
    [s({ network_engineer: Number.NaN }), { "racuni.network_engineer": "neispravno" }],
    [s({ student: "200" }), { "racuni.student": "neispravno" }],
  ])("rejects %j", (unos, greske) => {
    expect(provjeriUnos(unos)).toEqual(greske);
  });
});

it("predloziDomenu takes the faculty web host without www", () => {
  expect(predloziDomenu("http://www.fpzg.hr")).toBe("fpzg.hr");
  expect(predloziDomenu("https://fer.unizg.hr/")).toBe("fer.unizg.hr");
  expect(predloziDomenu(null)).toBe("");
  expect(predloziDomenu("nije url")).toBe("");
});

describe("greskaStvaranja", () => {
  const postojece = [{ fakultetId: "fpzg", aaiDomena: "fpzg.hr" }, { fakultetId: "ffzg", aaiDomena: "ffzg.hr" }];
  const g = (status, tijelo, unos = dobro) => greskaStvaranja(status, tijelo, unos, postojece);

  it("409 is placed on the faculty, the domain, both, or neither", () => {
    expect(g(409, { error: "vec_postoji" }, { fakultetId: "pmf", aaiDomena: "FPZG.hr" })).toEqual({ greska: "zauzeto", polja: { aaiDomena: "zauzeto" } });
    expect(g(409, { error: "vec_postoji" }, { fakultetId: "fpzg", aaiDomena: "x.hr" })).toEqual({ greska: "zauzeto", polja: { fakultetId: "zauzeto" } });
    expect(g(409, { error: "vec_postoji" }, { fakultetId: "fpzg", aaiDomena: "ffzg.hr" })).toEqual({
      greska: "zauzeto",
      polja: { fakultetId: "zauzeto", aaiDomena: "zauzeto" },
    });
    expect(g(409, { error: "vec_postoji" }, { fakultetId: "pmf", aaiDomena: "pmf.hr" })).toEqual({ greska: "zauzeto", polja: {} });
  });

  it("400 is placed by the server's message or field", () => {
    expect(g(400, { error: "nepoznat_fakultet" })).toEqual({ greska: "neispravan_unos", polja: { fakultetId: "nepoznato" } });
    expect(g(400, { error: "neispravan_unos", poruka: "aaiDomena nije ispravna domena" }).polja).toEqual({ aaiDomena: "neispravno" });
    expect(g(400, { greska: "neispravan_unos", polje: "aaiDomena" }).polja).toEqual({ aaiDomena: "neispravno" });
    expect(g(400, { error: "neispravan_unos", poruka: "teacher: broj računa mora biti cijeli broj od 0 do 5000" }).polja).toEqual({
      "racuni.teacher": "neispravno",
    });
    expect(g(400, { error: "neispravan_unos", poruka: "OIDC issuer nije zadan ili nije ispravan (AAI_OIDC_ISSUER)" })).toEqual({
      greska: "issuer",
      polja: {},
    });
    expect(g(400, { error: "neispravan_unos", poruka: "tijelo mora biti objekt" })).toEqual({ greska: "neispravan_unos", polja: {} });
  });

  it("401 and anything else", () => {
    expect(g(401, { error: "nije_prijavljen" }).greska).toBe("nije_prijavljen");
    expect(g(503, { error: "admin_nije_dostupan" }).greska).toBe("nedostupan");
    expect(g(500, null).greska).toBe("nedostupan");
  });
});
