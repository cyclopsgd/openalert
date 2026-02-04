# OpenAlert Backend Dockerfile for Fly.io
# Build from apps/api directory

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy migrations (schema is already in dist)
COPY --from=builder /app/migrations ./migrations

# Copy drizzle config
COPY --from=builder /app/drizzle.config.ts ./

EXPOSE 3001

CMD ["node", "dist/main.js"]
