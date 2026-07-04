# ============================================================================
# Boonducks Farm PLF Engine — Dockerfile
# Multi-stage: frontend build + backend runtime
# ============================================================================

# ---- Stage 1: Frontend build ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY client/ .
RUN npm run build

# ---- Stage 2: Backend runtime ----
FROM node:20-alpine

WORKDIR /app

# Copy backend source
COPY package.json package-lock.json ./
RUN npm ci --production --no-audit --no-fund

COPY server.js ./
COPY server.test.js ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/client/dist ./client/dist

# Expose API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Default: run in SIM mode (no DB required)
ENV MODE=sim
ENV PORT=5000

CMD ["node", "server.js"]
