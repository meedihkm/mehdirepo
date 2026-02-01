FROM node:20-alpine

WORKDIR /app

# Installation des dépendances système
RUN apk add --no-cache wget

# Copie des fichiers de dépendances
COPY package.json ./

# Installation des dépendances Node.js
RUN npm install

# Copie du code source
COPY . .

# Build TypeScript (si nécessaire)
RUN npm run build 2>/dev/null || echo "No build script"

# Exposition du port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Démarrage
CMD ["npm", "start"]
