# Multi-stage build for production
FROM node:18-slim AS builder

WORKDIR /app/apps/server

# Copy server package files
COPY apps/server/package*.json ./

# Install all dependencies
RUN npm install 2>&1

# Copy prisma schema
COPY apps/server/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate 2>&1

# Copy source files
COPY apps/server/src ./src
COPY apps/server/tsconfig.json ./

# Build TypeScript - capture full output
RUN npm run build 2>&1 | tee build.log && echo "Build successful" || (cat build.log && echo "Build failed!" && exit 1)

# Production stage
FROM node:18-slim AS production

WORKDIR /app/apps/server

COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY apps/server/package*.json ./

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
