// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MIDDLEWARE UPLOAD
// Gestion des uploads de fichiers avec Multer
// ═══════════════════════════════════════════════════════════════════════════════

import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import { AppError } from '../utils/errors';
import { config } from '../config';

// ─── CONFIGURATION STOCKAGE ──────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    const uploadDir = config.upload?.dir || './uploads';

    // Sous-dossier par type
    let subDir = 'misc';
    if (file.mimetype.startsWith('image/')) subDir = 'images';
    else if (file.mimetype === 'application/pdf') subDir = 'documents';

    const fullPath = path.join(uploadDir, subDir);
    cb(null, fullPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Nom unique: timestamp + hash + extension originale
    const ext = path.extname(file.originalname).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    cb(null, `${timestamp}-${hash}${ext}`);
  },
});

// ─── FILTRES ─────────────────────────────────────────────────────────────────

const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Type de fichier non autorisé. Formats acceptés: JPEG, PNG, WebP, GIF', 400));
  }
};

const documentFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Type de fichier non autorisé', 400));
  }
};

// ─── CONFIGURATIONS D'UPLOAD ─────────────────────────────────────────────────

const MAX_FILE_SIZE = config.upload?.maxSize || 10 * 1024 * 1024; // 10MB

// Upload d'image unique (produit, avatar)
export const uploadSingleImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('image');

// Upload de multiples images (preuves de livraison)
export const uploadMultipleImages = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
}).array('images', 5);

// Upload de document (pièce jointe)
export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('document');

// Upload signature (base64 ou image)
export const uploadSignature = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max pour signature
}).single('signature');

// Upload avatar utilisateur
export const uploadAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('avatar');

// ─── HELPER: URL PUBLIQUE ────────────────────────────────────────────────────

export function getFileUrl(filename: string, subDir: string = 'images'): string {
  return `/uploads/${subDir}/${filename}`;
}

// ─── HELPER: SUPPRIMER FICHIER ───────────────────────────────────────────────

import fs from 'fs';

export function deleteFile(filePath: string): boolean {
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── MIDDLEWARE: CRÉER DOSSIERS ──────────────────────────────────────────────

export function ensureUploadDirs() {
  const uploadDir = config.upload?.dir || './uploads';
  const dirs = ['images', 'documents', 'misc', 'signatures', 'avatars'];

  for (const dir of dirs) {
    const fullPath = path.join(uploadDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}
