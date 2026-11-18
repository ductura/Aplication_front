# Aplication_front

Administratorska aplikacija platforme Ductura (front). Gradi se u Next.js na Node.js, u JavaScriptu.

## Lokalno

- `pnpm dev` pokreće aplikaciju na http://127.0.0.1:3120/admin (`basePath: "/admin"`). Preglednik je inače otvara kroz edge proxy na http://localhost:8000/admin (ugovor toka, Ductus#2028 c.6993786629 §1).
- Aplikacija nikad ne zove Aplication_server iz preglednika. Stranice i rute u `app/api/` (BFF, `/admin/api/*`) zovu ga na poslužitelju, na adresi iz `APLICATION_SERVER_URL` (zadano http://127.0.0.1:3110). Prenose samo kolačić `ductura_admin`.
- Bez pravog Aplication_servera: `LAZNI_PORT=3110 pnpm fake-server` pokreće lažni poslužitelj s izmišljenim podacima (`tests/e2e/lazni-server.mjs`; korisničko ime `admin-test`, lozinka `lozinka-samo-za-test`).

| Stranica | Što radi |
| --- | --- |
| `/admin/prijava` | prijava administratora platforme korisničkim imenom i lozinkom |
| `/admin` | institucije s brojem računa po ulozi i obrazac za novu instituciju |
| `/admin/institucije/[id]` | stanje instance (zatražena, u izradi, aktivna) i podaci institucije |

Rute Aplication_servera koje front koristi: `POST /api/admin/prijava`, `POST /api/admin/odjava`, `GET /api/admin/ja`, `GET /api/admin/fakulteti`, `GET/POST /api/admin/institutions`.

## Testovi

- `pnpm test`: vitest (BFF, pravila obrasca, stranice, tokeni).
- `pnpm e2e`: Playwright nad produkcijskim buildom i lažnim Aplication_serverom, s axe provjerom (bez ozbiljnih nalaza) i bez grešaka u konzoli.
