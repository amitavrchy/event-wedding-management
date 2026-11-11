# syntax=docker/dockerfile:1.7
# Production image for the Utsab web app (Next.js standalone). Built in CI, never on the server.

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS build
# Both values are inlined at build time:
#  - API_URL: target of the /api/* rewrite (server-side proxy from the Next server to the API).
#  - NEXT_PUBLIC_SOCKET_URL: public Socket.IO URL used by the browser.
ARG API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ENV API_URL=${API_URL} \
    NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=256
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
