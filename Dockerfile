# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build/app

COPY app/package*.json ./
RUN npm ci

COPY app/ ./
RUN npm run build

# ── Stage 2: Build API ────────────────────────────────────────────────────────
FROM node:20-alpine AS api-build
WORKDIR /build/api

COPY api/package*.json ./
RUN npm ci

COPY api/tsconfig.json ./
COPY api/src/ ./src/
RUN npm run build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=api-build /build/api/package*.json ./
COPY --from=api-build /build/api/node_modules  ./node_modules
COPY --from=api-build /build/api/dist          ./dist

# Built React app — Express serves this as static files in production
COPY --from=frontend-build /build/app/dist ./client

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["node", "dist/index.js"]
