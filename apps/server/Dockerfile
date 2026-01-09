# Multi-stage build for production
FROM node:18-slim AS builder

WORKDIR /app/apps/server

# Copy server package files
COPY apps/server/package*.json ./

# Install dependencies
RUN npm install

# Copy prisma schema first
COPY apps/server/prisma ./prisma

# Generate Prisma client BEFORE copying source files
RUN npx prisma generate

# Now copy source files
COPY apps/server/src ./src
COPY apps/server/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-slim AS production

WORKDIR /app/apps/server

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
