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
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
