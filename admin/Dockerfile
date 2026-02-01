# Build React
FROM node:20-alpine AS builder

WORKDIR /app

# Copie des fichiers
COPY package.json ./
RUN npm install

COPY . .

# Build avec variables d'environnement par défaut
ENV VITE_API_URL=/api
RUN npm run build 2>&1 || (echo "Build failed, checking files..." && ls -la && cat package.json && exit 1)

# Nginx pour servir l'app
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
