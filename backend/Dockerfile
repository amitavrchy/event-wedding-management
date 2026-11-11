# syntax=docker/dockerfile:1.7
# Production image for the Utsab API (NestJS + Prisma). Built in CI, never on the server.

FROM node:24-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ---- build: full deps, generate Prisma client, compile TypeScript ----
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- deps: production dependencies only ----
# @prisma/client pulls in the `prisma` CLI as a peer dependency, so `prisma migrate deploy`
# is available in the runtime image without the rest of the dev dependencies.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate && test -x node_modules/.bin/prisma

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    NODE_OPTIONS=--max-old-space-size=320
ENV PATH=/app/node_modules/.bin:$PATH
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node prisma ./prisma
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "dist/main.js"]
