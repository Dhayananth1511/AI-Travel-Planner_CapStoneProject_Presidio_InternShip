# ============================================================
# client/Dockerfile — Multi-Stage Build
# Stage 1 (builder): Install deps + run Vite build → static files
# Stage 2 (production): Nginx serves the static files
# Result: Tiny nginx image serving your React app
# ============================================================

# ── Stage 1: Build React App ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build the production React bundle (output → /app/dist/)
# VITE_API_URL will be injected at build time via GitHub Actions
RUN npm run build

# ── Stage 2: Nginx Static Server ────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy the built React app from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config (handles SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (nginx default)
EXPOSE 80

# Nginx starts automatically — no CMD needed (defined in base image)
