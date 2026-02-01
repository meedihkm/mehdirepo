# Étape 1 : Build React
FROM node:18-alpine AS builder

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm ci

# Copie du code et build
COPY . .
RUN npm run build

# Étape 2 : Nginx pour servir l'app
FROM nginx:alpine

# Copie du build React
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
