# Optional image of Aplication_front for Render (docs/DEPLOY.md); the main
# target is Vercel (vercel.json). Kept out of the repository root on purpose: a
# root Dockerfile can switch a Vercel project to its Container preset.
# Build from the repository root: `docker build -f deploy/render/Dockerfile .`
#
# The app is not static: its BFF routes (app/api) call Aplication_server on the
# server, so the image runs `next start`. APLICATION_SERVER_URL comes from the
# environment at run time; the image holds no value of it and no secret. Same
# digest-pinned Node 24 base as Aplication_server and Institution_server.
FROM mirror.gcr.io/library/node:24.22.3-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0 AS deps
WORKDIR /src
RUN npm install --global pnpm@12.21.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM mirror.gcr.io/library/node:24.22.3-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0 AS build
WORKDIR /src
RUN npm install --global pnpm@12.21.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec next build

FROM mirror.gcr.io/library/node:24.22.3-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0
WORKDIR /app
# PORT is a default only; Render sets its own and `next start` follows it.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3120
COPY --from=deps /src/node_modules ./node_modules
COPY --from=build /src/package.json /src/next.config.mjs ./
COPY --from=build /src/src/lib ./src/lib
COPY --from=build /src/.next ./.next
EXPOSE 3120
USER node
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT??3120)+'/admin/prijava').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
