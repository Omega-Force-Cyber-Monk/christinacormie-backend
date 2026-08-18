# Base Image
FROM node:24-alpine AS base

# Install runtime dependencies and security utilities
RUN apk add --no-cache libc6-compat openssl dumb-init

WORKDIR /app

# Dependencies Stage
FROM node:24-alpine AS dependencies

WORKDIR /app

# Install build tools if any native modules need compilation
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package manifests and Prisma schema for caching layer
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Build Stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy installed dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Set dummy DATABASE_URL required for Prisma 7 config evaluation during generate
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Generate Prisma Client and build NestJS application
RUN npx prisma generate
RUN npm run build

# Remove development dependencies to keep production image minimal
RUN npm prune --omit=dev

# Production Runtime Stage
FROM base AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user and group for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy package metadata
COPY --from=build --chown=nestjs:nodejs /app/package.json ./

# Copy production node_modules (with generated Prisma client) and compiled app
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/prisma.config.ts ./

# Switch to non-root user
USER nestjs

# Expose default HTTP port
EXPOSE 3000

# Use dumb-init for proper signal handling and PID 1 process management
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start NestJS production server
CMD ["node", "dist/src/main.js"]
