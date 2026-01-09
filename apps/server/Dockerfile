# Multi-stage build for production
FROM node:18-slim AS builder

WORKDIR /app/apps/server

# Copy server package files
COPY apps/server/package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --verbose

# Copy prisma schema
COPY apps/server/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate || true

# Copy source files
COPY apps/server/src ./src
COPY apps/server/tsconfig.json ./

# Build TypeScript with verbose output
RUN npm run build 2>&1 || (echo "Build failed, showing error above" && exit 1)

# Production stage
FROM node:18-slim AS production

WORKDIR /app/apps/server

# Install only production dependencies
RUN npm ci --only=production --verbose || true

# Copy built files and dependencies from builder
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/prisma ./prisma
COPY apps/server/package*.json ./

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
