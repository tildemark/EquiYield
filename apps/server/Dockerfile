FROM node:18

WORKDIR /app

# Install dependencies
COPY apps/server/package*.json ./
RUN npm install 2>&1 | tee /tmp/npm-install.log || (cat /tmp/npm-install.log && exit 1)

# Copy source
COPY apps/server/ ./

# Generate Prisma
RUN npx prisma generate 2>&1 | tee /tmp/prisma.log || (cat /tmp/prisma.log && exit 1)

# Build TypeScript with verbose output
RUN npm run build 2>&1 | tee /tmp/build.log || (cat /tmp/build.log && exit 1)

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
