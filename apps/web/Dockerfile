# Multi-stage build for Next.js production
FROM node:18-slim AS builder

WORKDIR /app/apps/web

# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm install 2>&1

# Copy source files
COPY apps/web ./

# Set build-time environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_DEMO_MODE=true
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Build Next.js - capture full output
RUN npm run build 2>&1 | tee build.log && echo "Build successful" || (cat build.log && echo "Build failed!" && exit 1)

# Production stage
FROM node:18-slim AS production

WORKDIR /app/apps/web

# Copy artifacts from builder
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY apps/web/package*.json ./
COPY apps/web/next.config.mjs ./

# Create non-root user
RUN useradd -m -u 1001 nextjs || true

# Set ownership
RUN chown -R nextjs:nextjs /app/apps/web

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["npm", "start"]
