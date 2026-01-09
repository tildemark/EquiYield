# Multi-stage build for Next.js production
FROM node:18-slim AS builder

WORKDIR /app/apps/web

# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY apps/web ./

# Build Next.js
RUN npm run build

# Production stage
FROM node:18-slim AS production

WORKDIR /app/apps/web

# Copy built files from builder
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY apps/web/package*.json ./
COPY apps/web/next.config.mjs ./

# Create non-root user
RUN useradd -m -u 1001 nextjs

# Set ownership
RUN chown -R nextjs:nextjs /app/apps/web

USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start Next.js
CMD ["npm", "start"]
