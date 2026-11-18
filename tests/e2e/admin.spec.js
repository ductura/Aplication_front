// The admin flow from ugovor c.6993786629 §3.4 against the fake Aplication_server.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hr } from "../../src/i18n/hr.js";

const LAZNI = "http://127.0.0.1:3199";
const ADMIN = { ime: "admin-test", lozinka: "lozinka-samo-za-test" };
const o = hr.obrazac;

let greskeKonzole;

test.beforeEach(async ({ page, request }) => {
  await request.post(`${LAZNI}/__reset`);
  greskeKonzole = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Chrome logs every 4xx answer of fetch(). The BFF answers expected outcomes
    // (wrong password 401, too many attempts 429, invalid 400, taken 409) with
    // their real status; only those are allowed, nothing else.
    const ocekivano =
      /^Failed to load resource: the server responded with a status of (400|401|409|429) /.test(m.text()) &&
      /\/admin\/api\/(prijava|institucije)$/.test(m.location().url);
    if (!ocekivano) greskeKonzole.push(m.text());
  });
  page.on("pageerror", (e) => greskeKonzole.push(String(e)));
});

test.afterEach(() => {
  expect(greskeKonzole).toEqual([]);
});

async function bezOzbiljnihNalaza(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const ozbiljni = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(ozbiljni.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

async function prijavi(page) {
  await page.goto("/admin/prijava");
  await page.getByLabel(hr.prijava.korisnickoIme).fill(ADMIN.ime);
  await page.getByLabel(hr.prijava.lozinka).fill(ADMIN.lozinka);
  await page.getByRole("button", { name: hr.prijava.posalji }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: hr.home.heading })).toBeVisible();
}

test("without a session /admin goes to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/prijava$/);
  await page.goto("/admin/institucije/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/admin\/prijava$/);
  await expect(page.getByRole("heading", { name: hr.prijava.naslov })).toBeVisible();
  await bezOzbiljnihNalaza(page);
});

test("login shows 401 and 429 messages, then signs in", async ({ page }) => {
  await page.goto("/admin/prijava");
  await page.getByRole("button", { name: hr.prijava.posalji }).click();
  await expect(page.locator("#prijava-greska")).toHaveText(hr.prijava.obavezno);

  await page.getByLabel(hr.prijava.korisnickoIme).fill(ADMIN.ime);
  await page.getByLabel(hr.prijava.lozinka).fill("kriva-lozinka");
  await page.getByRole("button", { name: hr.prijava.posalji }).click();
  await expect(page.locator("#prijava-greska")).toHaveText("Korisničko ime ili lozinka nisu točni.");

  await page.getByLabel(hr.prijava.korisnickoIme).fill("zakljucan-test");
  await page.getByRole("button", { name: hr.prijava.posalji }).click();
  await expect(page.locator("#prijava-greska")).toHaveText(hr.prijava.previse(2));
  await bezOzbiljnihNalaza(page);

  await prijavi(page);
  await expect(page.getByText(hr.institucije.prazno)).toBeVisible();
  await expect(page.getByText(hr.traka.prijavljen(ADMIN.ime))).toBeVisible();
  await page.goto("/admin/prijava");
  await expect(page).toHaveURL(/\/admin$/);
});

test("adds an institution and follows its instance to active", async ({ page }) => {
  await prijavi(page);
  await bezOzbiljnihNalaza(page);
  await page.getByRole("button", { name: hr.institucije.dodaj }).click();
  await expect(page.getByLabel(o.fakultet)).toBeFocused();
  await expect(page.getByText(o.napomena)).toBeVisible();

  await page.getByLabel(o.fakultet).selectOption("fpzg");
  await expect(page.getByLabel(o.domena)).toHaveValue("fpzg.hr");
  await page.getByLabel(o.uloge.student).fill("200");
  await page.getByLabel(o.uloge.teacher).fill("50");
  await page.getByLabel(o.uloge.network_engineer).fill("3");
  await page.getByLabel(o.uloge.institution_admin).fill("1");
  await bezOzbiljnihNalaza(page);
  await page.getByRole("button", { name: o.posalji }).click();

  await expect(page).toHaveURL(/\/admin\/institucije\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fakultet političkih znanosti" })).toBeVisible();
  const stanje = page.getByRole("status");
  await expect(stanje).toContainText(hr.instanca.stanja.zatrazena);
  await bezOzbiljnihNalaza(page);
  await expect(stanje).toContainText(hr.instanca.stanja.u_izradi, { timeout: 10_000 });
  await expect(stanje).toContainText(hr.instanca.stanja.aktivna, { timeout: 10_000 });
  await expect(page.getByText(hr.instanca.osvjezava)).toHaveCount(0);

  await page.getByRole("link", { name: hr.instanca.natrag }).click();
  const red = page.getByRole("row", { name: /Fakultet političkih znanosti/ });
  await expect(red.getByRole("cell")).toHaveText(["fpzg.hr", "200", "50", "3", "1", hr.instanca.stanja.aktivna]);
  await bezOzbiljnihNalaza(page);
});

test("shows errors per field: invalid input, taken faculty and taken domain", async ({ page }) => {
  await prijavi(page);
  await page.getByRole("button", { name: hr.institucije.dodaj }).click();
  await page.getByLabel(o.fakultet).selectOption("fpzg");
  await page.getByRole("button", { name: o.posalji }).click();
  await expect(page).toHaveURL(/\/admin\/institucije\//);
  await page.goto("/admin");

  await page.getByRole("button", { name: hr.institucije.dodaj }).click();
  await expect(page.getByRole("option", { name: o.vecDodan("Fakultet političkih znanosti") })).toBeDisabled();

  await page.getByRole("button", { name: o.posalji }).click();
  await expect(page.getByText(o.greske.fakultetObavezan)).toBeVisible();
  await expect(page.getByLabel(o.fakultet)).toBeFocused();

  await page.getByLabel(o.fakultet).selectOption("ffzg");
  await page.getByLabel(o.domena).fill("ne valja");
  await page.getByLabel(o.uloge.institution_admin).fill("0");
  await page.getByRole("button", { name: o.posalji }).click();
  await expect(page.getByLabel(o.domena)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(o.greske.domenaNeispravna)).toBeVisible();
  await expect(page.getByText(o.greske.broj(1, 20))).toBeVisible();
  await bezOzbiljnihNalaza(page);

  // 409 from the server: the domain belongs to an existing institution.
  await page.getByLabel(o.domena).fill("FPZG.hr");
  await page.getByLabel(o.uloge.institution_admin).fill("1");
  await page.getByRole("button", { name: o.posalji }).click();
  await expect(page.getByText(o.greske.domenaZauzeta)).toBeVisible();
  await expect(page.getByLabel(o.domena)).toBeFocused();

  // Corrected input goes through.
  await page.getByLabel(o.domena).fill("ffzg.hr");
  await page.getByRole("button", { name: o.posalji }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Filozofski fakultet" })).toBeVisible();
});

test("a refused instance shows the reason and stops refreshing", async ({ page }) => {
  await prijavi(page);
  await page.getByRole("button", { name: hr.institucije.dodaj }).click();
  await page.getByLabel(o.fakultet).selectOption("pmf");
  await page.getByLabel(o.domena).fill("odbijena.pmf.hr");
  await page.getByRole("button", { name: o.posalji }).click();
  const stanje = page.getByRole("status");
  await expect(stanje).toContainText(hr.instanca.stanja.zatrazena);
  await expect(stanje).toContainText(hr.instanca.stanja.greska, { timeout: 15_000 });
  await expect(page.getByText(hr.instanca.kodovi.domena_zauzeta)).toBeVisible();
  await expect(page.getByText(hr.instanca.osvjezava)).toHaveCount(0);
  await bezOzbiljnihNalaza(page);
});

test("logout ends the session", async ({ page }) => {
  await prijavi(page);
  await page.getByRole("button", { name: hr.traka.odjava }).click();
  await expect(page).toHaveURL(/\/admin\/prijava$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/prijava$/);
});
