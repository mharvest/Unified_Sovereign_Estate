# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=20-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app

# Install dependencies for backend
COPY se7en-backend/package.json se7en-backend/tsconfig.json ./se7en-backend/
RUN cd se7en-backend && npm install --legacy-peer-deps || true

# Install dependencies for frontend
COPY frontend/package.json frontend/tsconfig.json frontend/next.config.js ./frontend/
RUN cd frontend && npm install --legacy-peer-deps || true

# Copy source (expect build context at repo root)
COPY . .

CMD ["bash", "-lc", "echo 'Use docker compose to orchestrate services' && tail -f /dev/null"]
