FROM node:18

WORKDIR /app

# Copy everything pre-built
COPY apps/server/package*.json ./
COPY apps/server/node_modules ./node_modules
COPY apps/server/dist ./dist
COPY apps/server/prisma ./prisma

# Generate Prisma in case node_modules/.prisma is missing
RUN npx prisma generate || true

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
