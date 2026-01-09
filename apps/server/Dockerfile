# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app/apps/server

# Copy server package files
COPY apps/server/package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY apps/server/prisma ./prisma

# Copy source files
COPY apps/server/src ./src
COPY apps/server/tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app/apps/server

# Install production dependencies only
COPY apps/server/package*.json ./
RUN npm ci --only=production

# Copy built files and Prisma schema
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/apps/server/node_modules/.prisma ./node_modules/.prisma

# Copy migration files
COPY apps/server/prisma/migrations ./prisma/migrations

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
