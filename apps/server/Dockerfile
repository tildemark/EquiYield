FROM node:18

WORKDIR /app

# Copy root workspace files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/

# Install all workspace dependencies from root
RUN npm install

# Copy server source
COPY apps/server/ ./apps/server/

# Generate Prisma and build from workspace
WORKDIR /app/apps/server
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
