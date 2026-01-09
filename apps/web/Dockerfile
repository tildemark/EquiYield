# Multi-stage build for Next.js production
FROM node:18-alpine AS builder

WORKDIR /app/apps/web

# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY apps/web ./

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app/apps/web

# Install production dependencies only
COPY apps/web/package*.json ./
RUN npm install --production

# Copy built files
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/next.config.mjs ./
COPY --from=builder /app/apps/web/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set ownership
RUN chown -R nextjs:nodejs /app/apps/web

USER nextjs

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Next.js
CMD ["npm", "start"]
