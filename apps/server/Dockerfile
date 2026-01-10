FROM node:18

WORKDIR /app

# Copy server package files and install directly
COPY apps/server/package*.json ./
RUN npm install

# Copy server source including seed script
COPY apps/server/ ./

# Generate Prisma and build
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
