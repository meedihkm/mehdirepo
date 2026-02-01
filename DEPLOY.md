# 🚀 Déploiement AWID v3.0 sur Coolify

## Déploiement en UN SEUL SERVICE

Tu n'as besoin de créer qu'**UN SEUL** service dans Coolify.

---

## ⚙️ Configuration Coolify

### 1. Créer le service

- **Type** : `Public Repository`
- **Repository URL** : `https://github.com/meedihkm/mehdirepo`
- **Build Pack** : `Docker Compose`
- **Port** : `3000` (port principal du backend)
- **Docker Compose File** : `docker-compose.yml`

### 2. Variables d'environnement

Copie-colle ces variables dans Coolify :

```env
# Base de données (obligatoire - change le mot de passe!)
POSTGRES_USER=awid_admin
POSTGRES_PASSWORD=ton_mot_de_passe_super_fort_ici
POSTGRES_DB=awid_v3

# PGAdmin (obligatoire)
PGADMIN_EMAIL=tonemail@exemple.com
PGADMIN_PASSWORD=ton_mot_de_passe_pgadmin

# JWT (obligatoire - génère des clés longues avec: openssl rand -base64 64)
JWT_SECRET=ta_cle_jwt_tres_longue_64_caracteres_minimum
JWT_REFRESH_SECRET=ta_cle_refresh_differente_64_caracteres

# MinIO (obligatoire)
MINIO_ROOT_USER=awidminio
MINIO_ROOT_PASSWORD=ton_mot_de_passe_minio_super_fort
MINIO_BUCKET=awid-uploads
```

### 3. Ports exposés automatiquement

Coolify va exposer ces ports sur ton VPS :

| Service | Port VPS | Accès | Description |
|---------|----------|-------|-------------|
| Backend API | `3000` | `http://TON_IP:3000` | API REST |
| Admin | `8080` | `http://TON_IP:8080` | Interface admin |
| PostgreSQL | `5432` | `http://TON_IP:5432` | Base de données |
| **PGAdmin** | `5050` | `http://TON_IP:5050` | **Gestion BDD** ✅ |
| Redis | `6379` | `http://TON_IP:6379` | Cache |
| MinIO API | `9000` | `http://TON_IP:9000` | Stockage S3 |
| **MinIO Console** | `9001` | `http://TON_IP:9001` | **Console S3** ✅ |

---

## 🔐 Accès après déploiement

### PGAdmin (gestion base de données)
- **URL** : `http://TON_IP:5050`
- **Email** : ton `PGADMIN_EMAIL`
- **Password** : ton `PGADMIN_PASSWORD`

Pour te connecter à PostgreSQL dans PGAdmin :
- Host : `postgres`
- Port : `5432`
- Database : `awid_v3`
- User : `awid_admin`
- Password : ton `POSTGRES_PASSWORD`

### MinIO Console (stockage fichiers)
- **URL** : `http://TON_IP:9001`
- **Access Key** : `awidminio` (ou ton `MINIO_ROOT_USER`)
- **Secret Key** : ton `MINIO_ROOT_PASSWORD`

### API Backend
- **URL** : `http://TON_IP:3000`
- **Health check** : `http://TON_IP:3000/health`

### Admin React
- **URL** : `http://TON_IP:8080`

---

## ✅ Vérification

Une fois déployé, vérifie que tout fonctionne :

```bash
# Sur ton VPS (SSH optionnel)
docker ps

# Tu dois voir 6 containers :
# - awid-backend
# - awid-admin
# - awid-postgres
# - awid-redis
# - awid-pgadmin
# - awid-minio
```

---

## 🐛 Problèmes courants

### "Port already in use"
Change les ports dans le docker-compose.yml si déjà utilisés.

### PostgreSQL ne démarre pas
Vérifie que `POSTGRES_PASSWORD` est bien défini (pas vide).

### Backend ne voit pas la DB
Attends 30s que PostgreSQL soit prêt, puis redémarre le backend :
```bash
docker restart awid-backend
```

---

## 📝 Commandes utiles (SSH si besoin)

```bash
# Voir les logs
docker logs -f awid-backend
docker logs -f awid-postgres

# Redémarrer un service
docker restart awid-backend

# Backup BDD
docker exec awid-postgres pg_dump -U awid_admin awid_v3 > backup.sql

# Entrer dans la BDD
docker exec -it awid-postgres psql -U awid_admin -d awid_v3
```

---

## 🎉 C'est tout !

Un seul service Coolify = tout est déployé automatiquement.
