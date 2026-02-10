FROM node:20-bookworm-slim

WORKDIR /app/backend

# ---- System deps: python for MCP server ----
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

# ---- Node deps ----
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# ---- Build backend ----
COPY backend/ ./
RUN npm run build

# ---- Copy + install alpaca-mcp-server (stdio transport) ----
WORKDIR /app
COPY alpaca-mcp-server/ ./alpaca-mcp-server/
RUN pip3 install --no-cache-dir -e ./alpaca-mcp-server

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/server.js"]

