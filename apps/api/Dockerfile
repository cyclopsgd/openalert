# OpenAlert Backend Dockerfile for Fly.io
# Build from apps/api directory

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy migrations and schema
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/src/database/schema ./src/database/schema

# Copy drizzle config
COPY drizzle.config.ts ./

EXPOSE 3001

CMD ["node", "dist/main.js"]
