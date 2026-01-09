FROM node:18

WORKDIR /app

COPY apps/web/package*.json ./
RUN npm install

COPY apps/web/ ./

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
