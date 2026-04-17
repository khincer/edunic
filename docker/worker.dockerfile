# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npx nx build worker

# ---- Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist/apps/worker ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

CMD ["node", "dist/main.js"]
