# Multi-stage build for Next.js production
FROM node:18-alpine AS builder

WORKDIR /app/apps/web

# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source files
COPY apps/web ./

# Build Next.js (disable telemetry and set production)
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app/apps/web

# Copy built files from builder
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY apps/web/package*.json ./
COPY apps/web/next.config.mjs ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set ownership
RUN chown -R nextjs:nodejs /app/apps/web

USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start Next.js
CMD ["npm", "start"]
