# OpenAlert Backend Dockerfile for Fly.io

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci --workspace=apps/api

# Copy source
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Build
WORKDIR /app/apps/api
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm ci --workspace=apps/api --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/drizzle ./apps/api/drizzle

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]
