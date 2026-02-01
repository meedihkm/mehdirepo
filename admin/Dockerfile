# Étape 1 : Build React
FROM node:20-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances
COPY package.json ./

# Installation des dépendances (npm install au lieu de npm ci)
RUN npm install

# Copie du code source
COPY . .

# Build de l'application
RUN npm run build

# Étape 2 : Nginx pour servir l'app
FROM nginx:alpine

# Copie du build React
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx avec proxy API
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml; \
    \
    # Proxy API vers le backend \
    location /api { \
        proxy_pass http://backend:3000; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
    } \
    \
    # Servir l'app React \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
