# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/

# Install dependencies
RUN npm ci

# Copy source files
COPY apps/server ./apps/server
COPY prisma ./apps/server/prisma

# Generate Prisma client
WORKDIR /app/apps/server
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
RUN npm ci --only=production

# Copy built files and Prisma schema
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/node_modules/.prisma ./apps/server/node_modules/.prisma

# Copy migration files
COPY --from=builder /app/apps/server/prisma/migrations ./apps/server/prisma/migrations

WORKDIR /app/apps/server

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
