# syntax=docker/dockerfile:1

# --- build: compile the SPA ------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked in at build time — Vite inlines import.meta.env.VITE_BACKEND_IP into the bundle, so
# changing it later requires a rebuild (see CLAUDE.md). Empty string in this deployment: the
# frontend and API are same-origin behind the Caddy stage below, so BASE_URL + path in
# src/api/client.js resolves to plain same-origin relative paths.
ARG VITE_BACKEND_IP=""
ENV VITE_BACKEND_IP=$VITE_BACKEND_IP
RUN npm run build

# --- serve: static files + reverse proxy to the backend service, with automatic HTTPS --------
# Caddy replaces Nginx (item 42 — see ARCHITECTURE_REVIEW.md): it issues and renews its own
# Let's Encrypt certificate for whatever domain SITE_ADDRESS names, with no separate certbot
# service or renewal cron. It's also the one and only proxy hop in front of the backend, which
# matters for app.js's `trust proxy 1` and the per-IP login rate limiter — see the Caddyfile.
FROM caddy:2-alpine AS serve
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443 443/udp
