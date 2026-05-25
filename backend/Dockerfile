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

RUN npm ci

# =========================
# Build Stage
# =========================
FROM base AS build

COPY package*.json ./

RUN npm ci

COPY . .

# Dummy DB URL only for prisma generate
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma Client
RUN npx prisma generate

# =========================
# Production Runner
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy application
COPY --from=build /app ./

# Install wget for healthcheck
RUN apk add --no-cache wget

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
CMD wget -qO- http://localhost:${PORT}/health || exit 1

# Start application
CMD ["node", "src/app.js"]