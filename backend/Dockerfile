FROM node:18-alpine

WORKDIR /app

# Installation des dépendances système
RUN apk add --no-cache wget

# Copie des fichiers de dépendances
COPY package*.json ./
RUN npm ci --only=production

# Copie du code source
COPY . .

# Build TypeScript
RUN npm run build

# Exposition du port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Démarrage
CMD ["node", "dist/index.js"]
