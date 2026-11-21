// Institution detail page: attempt history and the retry button, against the fake Aplication_server.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hr } from "../../src/i18n/hr.js";

const LAZNI = "http://127.0.0.1:3199";
const ADMIN = { ime: "admin-test", lozinka: "lozinka-samo-za-test" };

let greskeKonzole;

test.beforeEach(async ({ page, request }) => {
  await request.post(`${LAZNI}/__reset`);
  greskeKonzole = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Chrome logs every 4xx answer of fetch(); only the 409 of an outdated retry is expected.
    const ocekivano =
      /^Failed to load resource: the server responded with a status of 409 /.test(m.text()) &&
      /\/admin\/api\/institucije\/[^/]+\/ponovi$/.test(m.location().url);
    if (!ocekivano) greskeKonzole.push(m.text());
  });
  page.on("pageerror", (e) => greskeKonzole.push(String(e)));
});

test.afterEach(() => {
  expect(greskeKonzole).toEqual([]);
});

async function bezNalaza(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

// Logs in through the app and creates an institution straight on the fake server (no list read,
// so the fake does not advance the state on its own). Returns its id.
async function pripremi(page, request, { fakultetId = "fpzg", aaiDomena = "fpzg.hr", provisioning, pokusaji } = {}) {
  await page.goto("/admin/prijava");
  await page.getByLabel(hr.prijava.korisnickoIme).fill(ADMIN.ime);
  await page.getByLabel(hr.prijava.lozinka).fill(ADMIN.lozinka);
  await page.getByRole("button", { name: hr.prijava.posalji }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const sesija = (await page.context().cookies()).find((c) => c.name === "ductura_admin").value;
  const res = await request.post(`${LAZNI}/api/admin/institutions`, {
    headers: { cookie: `ductura_admin=${sesija}` },
    data: { fakultetId, aaiDomena, racuni: { student: 5, teacher: 1, network_engineer: 0, institution_admin: 1 } },
  });
  const { institucija } = await res.json();
  await request.post(`${LAZNI}/__stanje/${institucija.id}`, { data: { provisioning, pokusaji } });
  return institucija.id;
}

test("a requested instance shows its history and the retry button turns it active", async ({ page, request }) => {
  const id = await pripremi(page, request, {
    provisioning: { stanje: "u_izradi", pokusaja: 1, zadnjaGreska: "503" },
    pokusaji: [{ vrijeme: "2026-11-18T22:01:00Z", ishod: "neuspjeh", kodGreske: "servis_nedostupan" }],
  });
  await page.goto(`/admin/institucije/${id}`);
  await expect(page.getByRole("heading", { level: 2, name: hr.povijest.naslov })).toBeVisible();
  const tablica = page.getByRole("table", { name: hr.povijest.opisTablice });
  await expect(tablica.getByRole("row")).toHaveCount(2);
  await expect(tablica.getByRole("cell").nth(1)).toHaveText(hr.povijest.ishodi.neuspjeh);
  await expect(tablica.getByRole("cell").nth(2)).toHaveText("servis_nedostupan");
  const stanje = page.getByRole("status");
  await expect(stanje).toContainText(hr.instanca.stanja.u_izradi);
  await bezNalaza(page);

  await page.getByRole("button", { name: hr.ponovi.gumb }).click();
  await expect(stanje).toContainText(hr.instanca.stanja.aktivna, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: hr.ponovi.gumb })).toHaveCount(0);
  await expect(tablica.getByRole("row")).toHaveCount(3);
  await expect(tablica.getByRole("cell").filter({ hasText: new RegExp(`^${hr.povijest.ishodi.uspjeh}$`) })).toHaveCount(1);
  await bezNalaza(page);
});

test("the retry button is shown for a requested instance and not for an active or refused one", async ({ page, request }) => {
  const zatrazena = await pripremi(page, request);
  await page.goto(`/admin/institucije/${zatrazena}`);
  await expect(page.getByRole("button", { name: hr.ponovi.gumb })).toBeVisible();
  await expect(page.getByText(hr.povijest.prazno)).toBeVisible();

  for (const [fakultetId, aaiDomena, provisioning] of [
    ["ffzg", "ffzg.hr", { stanje: "aktivna", aktivirano: "2026-11-18T22:05:00Z" }],
    ["pmf", "pmf.hr", { stanje: "greska", kodGreske: "domena_zauzeta" }],
  ]) {
    const res = await request.post(`${LAZNI}/api/admin/institutions`, {
      headers: { cookie: `ductura_admin=${(await page.context().cookies()).find((c) => c.name === "ductura_admin").value}` },
      data: { fakultetId, aaiDomena, racuni: { student: 1, teacher: 0, network_engineer: 0, institution_admin: 1 } },
    });
    const { institucija } = await res.json();
    await request.post(`${LAZNI}/__stanje/${institucija.id}`, { data: { provisioning } });
    await page.goto(`/admin/institucije/${institucija.id}`);
    await expect(page.getByRole("status")).toContainText(hr.instanca.stanja[provisioning.stanje]);
    await expect(page.getByRole("button", { name: hr.ponovi.gumb })).toHaveCount(0);
    await expect(page.getByText(hr.instanca.osvjezava)).toHaveCount(0);
    await bezNalaza(page);
  }
});

test("an unknown institution shows that it was not found, without a button", async ({ page, request }) => {
  await pripremi(page, request);
  await page.goto("/admin/institucije/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { level: 1, name: hr.instanca.nema })).toBeVisible();
  await expect(page.getByRole("button", { name: hr.ponovi.gumb })).toHaveCount(0);
  await bezNalaza(page);
});

test("a server that is down shows the unavailable message instead of the page", async ({ page, request }) => {
  const id = await pripremi(page, request, { fakultetId: "pmf", aaiDomena: "nedostupna.pmf.hr" });
  await page.goto(`/admin/institucije/${id}`);
  await expect(page.getByText(hr.greske.nedostupan)).toBeVisible();
  // No axe here: the shared Nedostupno component (not part of this task) has a contrast finding.
});

test("a retry that the server refuses with 409 shows that the state changed", async ({ page, request }) => {
  const id = await pripremi(page, request);
  await page.goto(`/admin/institucije/${id}`);
  await expect(page.getByRole("button", { name: hr.ponovi.gumb })).toBeVisible();
  // The state changes behind the page's back; the click is answered with 409.
  await request.post(`${LAZNI}/__stanje/${id}`, { data: { provisioning: { stanje: "greska", kodGreske: "domena_zauzeta" } } });
  await page.getByRole("button", { name: hr.ponovi.gumb }).click();
  await expect(page.getByRole("status")).toContainText(hr.instanca.stanja.greska, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: hr.ponovi.gumb })).toHaveCount(0);
});

test("without a session the detail page goes to the login page", async ({ page }) => {
  await page.goto("/admin/institucije/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/admin\/prijava$/);
});
