FROM node:20-alpine

WORKDIR /app

# Installation des dépendances système
RUN apk add --no-cache wget

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances Node.js
RUN npm install

# Argument pour invalider le cache (changer la valeur pour forcer un rebuild)
ARG CACHEBUST=2

# Copie du code source
COPY . .

# Supprimer les anciens fichiers compilés pour forcer une recompilation complète
RUN rm -rf dist

# Build TypeScript - Échouer si erreurs
RUN npm run build

# Vérification que les fichiers sont créés
RUN ls -la dist/controllers/organization.controller.js || (echo "ERREUR: organization.controller.js non généré" && cat build.log && exit 1)

# Exposition du port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Démarrage
CMD ["npm", "start"]
