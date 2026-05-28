FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies without running postinstall
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts

# Build
FROM base AS build
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts
COPY . .

# Generate Prisma client explicitly
RUN npx prisma generate

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/package*.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]