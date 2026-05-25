# =========================
# Base Image
# =========================
FROM node:20-alpine AS base

WORKDIR /app

# =========================
# Install Dependencies
# =========================
FROM base AS deps

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

# =========================
# Build Stage
# =========================
FROM base AS build

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate

# =========================
# Production Runner
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app ./

RUN apk add --no-cache wget

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["node", "src/app.js"]