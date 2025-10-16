FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci && npm cache clean --force
COPY src/ ./src/

RUN npm run build

# ===============================================
# Production stage
# ===============================================
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
