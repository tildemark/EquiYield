# Multi-stage build for Next.js production
FROM node:18-slim AS builder

WORKDIR /app/apps/web

# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm ci --verbose

# Copy source files
COPY apps/web ./

# Set build-time environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_DEMO_MODE=true
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Build Next.js with verbose output
RUN npm run build 2>&1 || (echo "Next.js build failed, see error above" && exit 1)

# Production stage
FROM node:18-slim AS production

WORKDIR /app/apps/web

# Install only production dependencies
RUN npm ci --only=production --verbose || true

# Copy built files from builder
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY apps/web/package*.json ./
COPY apps/web/next.config.mjs ./

# Create non-root user
RUN useradd -m -u 1001 nextjs || true

# Set ownership
RUN chown -R nextjs:nextjs /app/apps/web

USER nextjs

# Expose port
EXPOSE 3000

# Set runtime environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start Next.js
CMD ["npm", "start"]
