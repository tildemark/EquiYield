FROM node:18

WORKDIR /app

# Copy web package files and install directly
COPY apps/web/package*.json ./
RUN npm install

# Copy web source
COPY apps/web/ ./

# Build with API URL
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
