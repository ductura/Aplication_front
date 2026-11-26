# Aplication_front

Administratorska aplikacija platforme Ductura (front). Gradi se u Next.js na Node.js, u JavaScriptu.

## Lokalno

- `pnpm dev` pokreće aplikaciju na http://127.0.0.1:3120/administracija (`basePath: "/administracija"`, `src/lib/putanje.js`). Preglednik je inače otvara kroz edge proxy na http://localhost:8000/administracija (karta adresa D-318, DAN-1574; ugovor toka Ductus#2028 c.6993786629 §1). Stare adrese `/admin/…` trajno (301) preusmjerava edge, ne ova aplikacija; izravno na :3120 one vraćaju 404.
- Aplikacija nikad ne zove Aplication_server iz preglednika. Preglednik zove samo BFF na `/administracija/api/v1/*` (`src/lib/putanje.js`, rute u `app/api/v1/`; starije putanje `/administracija/api/*` vode na iste rukovatelje). BFF zove Aplication_server na poslužitelju, na adresi iz `APLICATION_SERVER_URL` (zadano http://127.0.0.1:3110). Prenose samo kolačić `ductura_admin`.
- Bez pravog Aplication_servera: `LAZNI_PORT=3110 pnpm fake-server` pokreće lažni poslužitelj s izmišljenim podacima (`tests/e2e/lazni-server.mjs`; korisničko ime `admin-test`, lozinka `lozinka-samo-za-test`).

| Stranica | Što radi |
| --- | --- |
| `/administracija/prijava` | prijava administratora platforme korisničkim imenom i lozinkom; ovamo vodi i odjava |
| `/administracija` | institucije s brojem računa po ulozi i obrazac za novu instituciju |
| `/administracija/institucije/[id]` | stanje instance (zatražena, u izradi, aktivna, odbijena), povijest pokušaja podizanja instance (od najnovijeg) i podaci institucije; dok je instanca zatražena ili u izradi, stranica se sama osvježava i nudi gumb „Pokušaj ponovno” |

Rute BFF-a (preglednik, `/administracija/api/v1`): `POST /prijava`, `POST /odjava`, `POST /institucije`, `POST /institucije/{id}/ponovi`. Mutacije primaju samo JSON s istog izvora; tijelo je ograničeno na 16 KB i ne učitava se cijelo prije provjere (preveliki `Content-Length` odbija se odmah, a tok bez njega prekida se čim prijeđe granicu; `413`).

Rute Aplication_servera koje front koristi: `POST /api/admin/prijava`, `POST /api/admin/odjava`, `GET /api/admin/ja`, `GET /api/admin/fakulteti`, `GET/POST /api/admin/institutions`, `GET /api/admin/institutions/{id}` (institucija s poviješću pokušaja) i `POST /api/admin/institutions/{id}/ponovi` (novi pokušaj podizanja instance).

## Provjere i testovi

- `pnpm typecheck`: TypeScript provjera JavaScripta (`checkJs`) za `app/` i `src/` (`scripts/checks/jsconfig.json`).
- `pnpm lint`: ESLint (`eslint.config.mjs`); tekst sučelja smije doći samo iz kataloga `src/i18n/hr.js`, a komentari koji isključuju pravila ne vrijede.
- `pnpm test`: vitest (BFF i ograničenje tijela, pravila obrasca, stranice, tokeni, CSS, workflowi, lint pravila i skener zabranjenih izraza). Skener (`scripts/checks/forbidden-terms.mjs`, Ductus `docs/PRODUCT.md` §5) prolazi cijeli katalog poruka.
- `pnpm e2e`: Playwright nad produkcijskim buildom i lažnim Aplication_serverom, s axe provjerom (bez ozbiljnih nalaza) i bez grešaka u konzoli.
- CI (`.github/workflows/ci.yml`) na `main` i `migracija/**` pokreće sve gore navedeno i `pnpm build`; zbirni job `ci-ok` je zelen samo kad su svi ostali jobovi uspjeli.
