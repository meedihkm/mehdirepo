# ═══════════════════════════════════════════════════════════════════════════════
# AWID v3.0 - DOCKERFILE BACKEND
# Multi-stage build pour optimisation
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Installer les dépendances de compilation
RUN apk add --no-cache python3 make g++

# Copier les fichiers de package
COPY package.json package-lock.json ./

# Installer les dépendances
RUN npm ci --only=production && \
    npm cache clean --force

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Builder
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les dépendances
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./

# Installer les devDependencies pour le build
RUN npm ci

# Copier le code source
COPY src ./src

# Build TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Métadonnées
LABEL maintainer="AWID Team"
LABEL version="3.0"
LABEL description="AWID B2B Delivery API"

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copier les dépendances de production uniquement
COPY --from=deps /app/node_modules ./node_modules

# Copier le code compilé
COPY --from=builder /app/dist ./dist

# Copier les fichiers nécessaires
COPY package.json ./
COPY database/migrations ./database/migrations

# Créer les dossiers nécessaires
RUN mkdir -p /app/storage /app/logs && \
    chown -R nodejs:nodejs /app

# Changer vers l'utilisateur non-root
USER nodejs

# Exposer le port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Commande de démarrage
CMD ["node", "dist/index.js"]
