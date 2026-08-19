# syntax=docker/dockerfile:1

# --- build: compile the SPA ------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked in at build time — Vite inlines import.meta.env.VITE_BACKEND_IP into the bundle, so
# changing it later requires a rebuild (see CLAUDE.md). Empty string in this deployment: the
# frontend and API are same-origin behind the Nginx stage below, so BASE_URL + path in
# src/api/client.js resolves to plain same-origin relative paths.
ARG VITE_BACKEND_IP=""
ENV VITE_BACKEND_IP=$VITE_BACKEND_IP
RUN npm run build

# --- serve: static files + reverse proxy to the backend service ------------------------------
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
