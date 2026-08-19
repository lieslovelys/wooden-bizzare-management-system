# syntax=docker/dockerfile:1

# --- deps: install with native build tools available, then discard them -------------------
FROM node:24-alpine AS deps
WORKDIR /app
# bcrypt compiles a native module at install time — needs a toolchain, which the runtime
# stage below deliberately does not carry.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime: lean image, no build toolchain, non-root -------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chmod +x ./docker-entrypoint.sh \
  && addgroup -S appgroup \
  && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

# Runs pending migrations, then hands off to CMD. See docker-entrypoint.sh for why
# auto-migrate-on-boot is the deliberate choice for this single-VPS, single-operator deployment.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
