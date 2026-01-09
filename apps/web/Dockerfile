FROM node:18

WORKDIR /app

# Copy root workspace files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install all workspace dependencies from root
RUN npm install

# Copy web source
COPY apps/web/ ./apps/web/

# Build from workspace
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npx next build

EXPOSE 3000
CMD ["npm", "start"]
