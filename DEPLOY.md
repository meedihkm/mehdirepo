# 🚀 Déploiement AWID v3.0 sur Coolify

## Structure minimale requise

```
.
├── backend/
│   ├── Dockerfile          ⬅️ Fourni
│   └── ... (ton code)
├── admin/
│   ├── Dockerfile          ⬅️ Fourni
│   ├── nginx.conf          ⬅️ Fourni
│   └── ... (ton code)
├── mobile/
│   └── ... (ton code Flutter - pas de Docker)
├── docker-compose.yml      ⬅️ Fourni
├── .env.example            ⬅️ Fourni
├── .github/
│   └── workflows/
│       └── deploy.yml      ⬅️ Fourni (optionnel)
└── DEPLOY.md               ⬅️ Ce fichier
```

## 🚀 Déploiement rapide

### 1. Sur ton VPS (Coolify déjà installé)

```bash
ssh root@TON_IP
cd /data/coolify/services
git clone https://github.com/meedihkm/mehdirepo.git awid-v3
cd awid-v3

# Copier et configurer les variables
cp .env.example .env
nano .env
# Remplis les mots de passe !

# Lancer
chmod +x scripts/setup.sh 2>/dev/null || true
docker-compose up -d
```

### 2. Configurer Coolify

Dans l'interface Coolify (`http://TON_IP:8000`) :

Crée 4 services Docker Compose :

| Service | Docker Compose Path | Port | Domaine généré |
|---------|---------------------|------|----------------|
| backend | `./docker-compose.yml` | 3000 | `api-xxx.coolify.io` |
| admin | `./docker-compose.yml` | 80 | `xxx.coolify.io` |
| pgadmin | `./docker-compose.yml` | 80 | `db-xxx.coolify.io` |
| minio | `./docker-compose.yml` | 9001 | `console-s3-xxx.coolify.io` |

Colle le contenu de ton fichier `.env` dans l'onglet "Environment Variables" de chaque service.

### 3. Vérifier

- Backend : `https://api-xxx.coolify.io/health`
- Admin : `https://xxx.coolify.io`
- PGAdmin : `https://db-xxx.coolify.io`
- MinIO : `https://console-s3-xxx.coolify.io`

## 🔐 Variables d'environnement

Copie `.env.example` → `.env` et modifie :

```bash
# Base de données (obligatoire)
POSTGRES_PASSWORD=ton_mot_de_passe_fort

# PGAdmin (obligatoire)
PGADMIN_EMAIL=ton@email.com
PGADMIN_PASSWORD=ton_mot_de_passe

# JWT (obligatoire - génère des clés longues)
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# MinIO (obligatoire)
MINIO_ROOT_PASSWORD=ton_mot_de_passe_minio
```

## 📊 Services inclus

- **Backend** (Node.js) : API REST
- **Admin** (React + Nginx) : Interface web
- **PostgreSQL** : Base de données (persistent)
- **Redis** : Cache (persistent AOF)
- **PGAdmin** : Gestion BDD
- **MinIO** : Stockage S3
- **Backup** : Sauvegardes auto (2h du matin)

## 🔧 Commandes utiles

```bash
# Voir les logs
docker logs -f awid-backend
docker logs -f awid-postgres

# Redémarrer
docker-compose restart backend

# Backup manuel
docker exec awid-postgres pg_dump -U awid_admin awid_v3 > backup.sql

# Migrations
docker-compose exec backend npm run migrate

# Accès BDD
docker exec -it awid-postgres psql -U awid_admin -d awid_v3
```

## 🐛 Problèmes courants

**PostgreSQL ne démarre pas** :
```bash
docker-compose down -v  # ⚠️ Supprime les données
docker-compose up -d
```

**Backend ne voit pas la DB** :
```bash
docker-compose restart backend
```

**HTTPS ne marche pas** :
- Dans Coolify, vérifie que "HTTPS" est activé pour chaque service
- Attends 2-3 minutes que Let's Encrypt génère le certificat
