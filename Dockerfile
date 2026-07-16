FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
USER appuser
EXPOSE 3000
CMD ["node", "src/index.js"]
