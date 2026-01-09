FROM node:18

WORKDIR /app

COPY apps/server/package*.json ./
RUN npm install

COPY apps/server/ ./
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
