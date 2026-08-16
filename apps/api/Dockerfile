# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Set to non-root user
USER node
WORKDIR /app

# Install production dependencies only
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy compiled files and migrations
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node migrations/ ./migrations/

# Ensure safe defaults for production
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["node", "dist/server.js"]
