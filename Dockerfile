# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm ci && npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S budgeting -u 1001 -G nodejs

# Copy dependencies and built assets
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy necessary files
COPY backend/package*.json ./
COPY backend/src ./backend/src
COPY backend/migrations ./backend/migrations

# Set ownership
RUN chown -R budgeting:nodejs /app

USER budgeting

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV BIND_HOST=0.0.0.0

CMD ["node", "backend/dist/server.js"]