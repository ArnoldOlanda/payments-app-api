# =============================================================================
# NestJS Production Dockerfile - Multi-stage optimized
# =============================================================================
# Build:
#   docker build -t myapi:latest -f api/Dockerfile api/
#
# Stages:
#   builder   -> install all deps + compile TypeScript
#   prod-deps -> fresh install of ONLY production dependencies
#   production-> minimal runtime image (dist + prod node_modules + fonts)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder — install all deps (incl. devDeps) and compile TS
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Toolchain only needed if a native module requires compilation at install time
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copiar package files primero (mejor cache de capas)
COPY package.json yarn.lock ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Instalar todas las dependencias (incluyendo devDependencies) para el build
RUN yarn install --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Build de producción
RUN yarn build

# -----------------------------------------------------------------------------
# Stage 2: prod-deps — fresh install of ONLY production dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS prod-deps

WORKDIR /app
COPY package.json yarn.lock ./

# --ignore-scripts: no hay modulos nativos (bcryptjs y pg son pure JS)
# Resultado: un node_modules limpio sin devDeps (~30-40% mas chico)
RUN yarn install --production --frozen-lockfile --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 3: Production runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# dumb-init maneja señales correctamente (SIGTERM, SIGINT)
RUN apk add --no-cache dumb-init

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copiar solo lo necesario desde los stages previos
COPY --from=builder    --chown=nestjs:nodejs /app/dist          ./dist
COPY --from=prod-deps  --chown=nestjs:nodejs /app/node_modules  ./node_modules
COPY --from=builder    --chown=nestjs:nodejs /app/package.json  ./package.json
COPY --from=builder    --chown=nestjs:nodejs /app/fonts         ./fonts

# Si tienes archivos estáticos o templates, descomenta:
# COPY --from=builder --chown=nestjs:nodejs /app/public ./public
# COPY --from=builder --chown=nestjs:nodejs /app/views ./views

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000

# Cambiar a usuario no-root
USER nestjs

EXPOSE 3000

# dumb-init para graceful shutdown de NestJS
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]
