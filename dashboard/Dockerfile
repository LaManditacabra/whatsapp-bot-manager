FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# ─── Frontend build (React + Vite) ────────────────────────────────
FROM base AS frontend-build
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm ci
COPY dashboard/index.html dashboard/vite.config.js dashboard/postcss.config.js ./
COPY dashboard/src/ ./src/
COPY dashboard/public/logo.svg ./public/logo.svg
RUN npx vite build

# ─── Dashboard deps ───────────────────────────────────────────────
FROM base AS dashboard-deps
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm ci --omit=dev

# ─── Bot worker deps ──────────────────────────────────────────────
FROM base AS bot-deps
COPY bot/package.json bot/package-lock.json* ./bot/
WORKDIR /app/bot
RUN npm ci --omit=dev
WORKDIR /app

# ─── Final image ──────────────────────────────────────────────────
FROM base AS final
WORKDIR /app
ENV NODE_ENV=production
COPY --from=frontend-build /app/dist ./dist
COPY --from=dashboard-deps /app/node_modules ./node_modules
COPY --from=bot-deps /app/bot/node_modules /bot/node_modules
COPY dashboard/api/ ./api/
COPY dashboard/public/ ./public/
COPY bot/ /bot/
EXPOSE 3001
CMD ["node", "api/index.js"]
