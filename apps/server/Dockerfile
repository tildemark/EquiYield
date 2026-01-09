FROM node:18

WORKDIR /app

# Copy root workspace files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/

# Install all workspace dependencies INCLUDING devDependencies (needed for build)
RUN npm install

# Copy server source
COPY apps/server/ ./apps/server/

# Generate Prisma and build from workspace
WORKDIR /app/apps/server
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
