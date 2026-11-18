# Objava: Vercel (glavno) ili Render

Aplication_front je Next.js aplikacija pod `basePath: "/admin"`. Nije statična: rute u `app/api/` (BFF) zovu Aplication_server s poslužitelja. Zato ide na **Vercel** kao Next projekt, a Docker slika za **Render** je samo rezerva.

Preglednik je otvara na `https://ductura.org/admin`: Preloader na Vercelu prosljeđuje `/admin` i `/admin/*` na ovaj projekt (vidi `vercel.json` u Preloaderu).

## Datoteke

- `vercel.json`: okvir `nextjs`, instalacija `pnpm@12.21.0 install --frozen-lockfile` (preko `npx`, jer Vercel sam ne nudi pnpm 12) i gradnja `npm run build` (`next build`). Preusmjerava `/` na `/admin`. Rewriteovi za `/api/v1` ovdje nisu potrebni: front ih ne koristi, a Aplication_server zove samo s poslužitelja.
- `deploy/render/Dockerfile`: višefazna slika s `next start` na `$PORT` (zadano 3120), korisnik `node`, `HEALTHCHECK` na `/admin/prijava`. Nije u korijenu repoa namjerno: Dockerfile u korijenu može prebaciti Vercel projekt na predložak Container.
- `.dockerignore`: `.git`, `node_modules`, `.next`, `.local/` i sve `.env*` datoteke ne ulaze u kontekst gradnje.

## Varijable okoline

| Ime | Gdje | Vrijednost |
| --- | --- | --- |
| `APLICATION_SERVER_URL` | Vercel (Production i Preview) ili Render | https adresa Aplication_servera bez putanje, npr. `https://ductura-aplication-server.onrender.com` |

To je obična varijabla poslužitelja. Ne ide u preglednik i nije tajna, ali je ne upisuj u repo.

## Što Daniel radi ručno

1. Vercel: **Add New → Project**, repo `ductura/Aplication_front`. Root Directory ostaje korijen. Postavke gradnje dolaze iz `vercel.json`.
2. U projektu upisuješ `APLICATION_SERVER_URL`.
3. Javnu adresu projekta (npr. `https://ductura-admin.vercel.app`) upisuješ u `vercel.json` Preloadera umjesto `ZAMIJENI-aplication-front.invalid`.
4. Render je neobavezan: **New → Web Service**, Docker, Dockerfile Path `deploy/render/Dockerfile`, varijabla `APLICATION_SERVER_URL`.

Lokalno: `docker build -f deploy/render/Dockerfile -t aplication-front .`

Postavljanje projekta, registry i deploy nisu dio ovog PR-a.
