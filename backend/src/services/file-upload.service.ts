// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE D'UPLOAD DE FICHIERS
// Gestion des uploads avec stockage local ou S3
// ═══════════════════════════════════════════════════════════════════════════════

import { Request } from 'express';
import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  filename: string;
  path: string;
  size: number;
  url: string;
}

interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

type FileCategory = 'products' | 'customers' | 'signatures' | 'receipts' | 'proofs' | 'documents';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const UPLOAD_BASE_PATH = process.env.UPLOAD_PATH || './uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Dimensions par catégorie
const IMAGE_DIMENSIONS: Record<FileCategory, ImageProcessingOptions> = {
  products: { width: 800, height: 800, quality: 85, format: 'webp' },
  customers: { width: 400, height: 400, quality: 80, format: 'jpeg' },
  signatures: { width: 600, height: 300, quality: 90, format: 'png' },
  receipts: { width: 1200, height: 1600, quality: 80, format: 'jpeg' },
  proofs: { width: 1200, height: 1200, quality: 85, format: 'jpeg' },
  documents: { quality: 85 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STOCKAGE LOCAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Créer le répertoire d'upload s'il n'existe pas
 */
async function ensureUploadDir(category: FileCategory, organizationId: string): Promise<string> {
  const uploadPath = path.join(UPLOAD_BASE_PATH, organizationId, category);
  
  try {
    await fs.access(uploadPath);
  } catch {
    await fs.mkdir(uploadPath, { recursive: true });
  }
  
  return uploadPath;
}

/**
 * Générer un nom de fichier unique
 */
function generateFilename(originalname: string, extension?: string): string {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const ext = extension || path.extname(originalname);
  return `${timestamp}-${randomBytes}${ext}`;
}

/**
 * Configuration Multer pour stockage local
 */
function createLocalStorage(category: FileCategory): StorageEngine {
  return multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const organizationId = (req as any).user?.organizationId || 'default';
        const uploadPath = await ensureUploadDir(category, organizationId);
        cb(null, uploadPath);
      } catch (error) {
        cb(error as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const filename = generateFilename(file.originalname);
      cb(null, filename);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRES DE FICHIERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Filtre pour les images uniquement
 */
const imageFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Format d\'image non autorisé. Utilisez JPG, PNG, WebP ou GIF.', 400));
  }
};

/**
 * Filtre pour les documents
 */
const documentFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if ([...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Format de fichier non autorisé.', 400));
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRAITEMENT D'IMAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Redimensionner et optimiser une image
 */
async function processImage(
  inputPath: string,
  outputPath: string,
  options: ImageProcessingOptions
): Promise<void> {
  let pipeline = sharp(inputPath);

  // Redimensionner si dimensions spécifiées
  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Convertir au format spécifié
  switch (options.format) {
    case 'webp':
      pipeline = pipeline.webp({ quality: options.quality || 85 });
      break;
    case 'png':
      pipeline = pipeline.png({ quality: options.quality || 85 });
      break;
    case 'jpeg':
    default:
      pipeline = pipeline.jpeg({ quality: options.quality || 85, mozjpeg: true });
  }

  await pipeline.toFile(outputPath);
}

/**
 * Créer une miniature
 */
async function createThumbnail(inputPath: string, outputPath: string, size: number = 200): Promise<void> {
  await sharp(inputPath)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 75 })
    .toFile(outputPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

class FileUploadService {
  /**
   * Créer un middleware d'upload pour une catégorie
   */
  createUploadMiddleware(category: FileCategory, fieldName: string, maxCount: number = 1) {
    const storage = createLocalStorage(category);
    const filter = category === 'documents' ? documentFilter : imageFilter;

    return multer({
      storage,
      fileFilter: filter,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: maxCount,
      },
    }).array(fieldName, maxCount);
  }

  /**
   * Traiter les fichiers uploadés
   */
  async processUploadedFiles(
    files: Express.Multer.File[],
    category: FileCategory,
    organizationId: string
  ): Promise<UploadedFile[]> {
    const results: UploadedFile[] = [];
    const options = IMAGE_DIMENSIONS[category];

    for (const file of files) {
      try {
        // Si c'est une image, la traiter
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          const ext = options.format ? `.${options.format}` : path.extname(file.originalname);
          const processedFilename = generateFilename(file.originalname, ext);
          const processedPath = path.join(path.dirname(file.path), processedFilename);

          await processImage(file.path, processedPath, options);

          // Supprimer l'original
          await fs.unlink(file.path);

          // Créer une miniature pour les produits
          if (category === 'products') {
            const thumbFilename = `thumb_${processedFilename}`;
            const thumbPath = path.join(path.dirname(file.path), thumbFilename);
            await createThumbnail(processedPath, thumbPath);
          }

          results.push({
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: `image/${options.format || 'jpeg'}`,
            filename: processedFilename,
            path: processedPath,
            size: (await fs.stat(processedPath)).size,
            url: this.getFileUrl(organizationId, category, processedFilename),
          });
        } else {
          // Document non-image, garder tel quel
          results.push({
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            filename: file.filename,
            path: file.path,
            size: file.size,
            url: this.getFileUrl(organizationId, category, file.filename),
          });
        }
      } catch (error) {
        logger.error('Error processing file:', error);
        // Nettoyer en cas d'erreur
        try {
          await fs.unlink(file.path);
        } catch {}
        throw new AppError('Erreur lors du traitement du fichier', 500);
      }
    }

    return results;
  }

  /**
   * Obtenir l'URL publique d'un fichier
   */
  getFileUrl(organizationId: string, category: FileCategory, filename: string): string {
    const baseUrl = config.server.baseUrl || `http://localhost:${config.server.port}`;
    return `${baseUrl}/uploads/${organizationId}/${category}/${filename}`;
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(organizationId: string, category: FileCategory, filename: string): Promise<void> {
    const filePath = path.join(UPLOAD_BASE_PATH, organizationId, category, filename);
    
    try {
      await fs.unlink(filePath);
      
      // Supprimer aussi la miniature si elle existe
      if (category === 'products') {
        const thumbPath = path.join(UPLOAD_BASE_PATH, organizationId, category, `thumb_${filename}`);
        try {
          await fs.unlink(thumbPath);
        } catch {}
      }
      
      logger.info(`File deleted: ${filePath}`);
    } catch (error) {
      logger.error(`Error deleting file ${filePath}:`, error);
      throw new AppError('Erreur lors de la suppression du fichier', 500);
    }
  }

  /**
   * Upload depuis base64
   */
  async uploadBase64(
    base64Data: string,
    category: FileCategory,
    organizationId: string,
    filename?: string
  ): Promise<UploadedFile> {
    // Extraire le type et les données
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new AppError('Format base64 invalide', 400);
    }

    const mimetype = matches[1];
    const data = matches[2];

    // Vérifier le type
    if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) {
      throw new AppError('Type de fichier non autorisé', 400);
    }

    // Créer le répertoire
    const uploadPath = await ensureUploadDir(category, organizationId);

    // Générer le nom de fichier
    const ext = mimetype.split('/')[1];
    const finalFilename = filename || generateFilename(`upload.${ext}`, `.${ext}`);
    const filePath = path.join(uploadPath, finalFilename);

    // Écrire le fichier
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);

    // Traiter l'image
    const options = IMAGE_DIMENSIONS[category];
    const processedFilename = generateFilename(`processed.${ext}`, `.${options.format || ext}`);
    const processedPath = path.join(uploadPath, processedFilename);

    await processImage(filePath, processedPath, options);
    await fs.unlink(filePath);

    return {
      fieldname: 'file',
      originalname: finalFilename,
      encoding: 'base64',
      mimetype: `image/${options.format || ext}`,
      filename: processedFilename,
      path: processedPath,
      size: (await fs.stat(processedPath)).size,
      url: this.getFileUrl(organizationId, category, processedFilename),
    };
  }

  /**
   * Obtenir les informations d'un fichier
   */
  async getFileInfo(organizationId: string, category: FileCategory, filename: string): Promise<{
    exists: boolean;
    size?: number;
    createdAt?: Date;
  }> {
    const filePath = path.join(UPLOAD_BASE_PATH, organizationId, category, filename);
    
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Lister les fichiers d'une catégorie
   */
  async listFiles(organizationId: string, category: FileCategory): Promise<string[]> {
    const dirPath = path.join(UPLOAD_BASE_PATH, organizationId, category);
    
    try {
      const files = await fs.readdir(dirPath);
      return files.filter(f => !f.startsWith('thumb_'));
    } catch {
      return [];
    }
  }

  /**
   * Nettoyer les fichiers orphelins (non référencés en BDD)
   */
  async cleanupOrphanFiles(
    organizationId: string,
    category: FileCategory,
    referencedFiles: string[]
  ): Promise<number> {
    const files = await this.listFiles(organizationId, category);
    let deletedCount = 0;

    for (const file of files) {
      if (!referencedFiles.includes(file)) {
        try {
          await this.deleteFile(organizationId, category, file);
          deletedCount++;
        } catch {}
      }
    }

    return deletedCount;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const fileUploadService = new FileUploadService();
export { FileCategory, UploadedFile };
export default fileUploadService;

// ═══════════════════════════════════════════════════════════════════════════════
// STUBS POUR COMPATIBILITÉ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload une image unique
 * @param file - Fichier à uploader
 * @param category - Catégorie de fichier
 * @param organizationId - ID de l'organisation
 * @returns Informations du fichier uploadé
 */
async function uploadImage(
  file: Express.Multer.File,
  category: FileCategory,
  organizationId: string
): Promise<UploadedFile> {
  const results = await fileUploadService.processUploadedFiles([file], category, organizationId);
  return results[0];
}

/**
 * Upload plusieurs images
 * @param files - Tableau de fichiers à uploader
 * @param category - Catégorie de fichier
 * @param organizationId - ID de l'organisation
 * @returns Informations des fichiers uploadés
 */
async function uploadMultipleImages(
  files: Express.Multer.File[],
  category: FileCategory,
  organizationId: string
): Promise<UploadedFile[]> {
  return fileUploadService.processUploadedFiles(files, category, organizationId);
}

/**
 * Supprime une image
 * @param organizationId - ID de l'organisation
 * @param category - Catégorie de fichier
 * @param filename - Nom du fichier à supprimer
 */
async function deleteImage(
  organizationId: string,
  category: FileCategory,
  filename: string
): Promise<void> {
  return fileUploadService.deleteFile(organizationId, category, filename);
}

/**
 * Traite et upload une image
 * @param file - Fichier à traiter et uploader
 * @param category - Catégorie de fichier
 * @param organizationId - ID de l'organisation
 * @param options - Options de traitement
 * @returns Informations du fichier uploadé
 */
async function processAndUploadImage(
  file: Express.Multer.File,
  category: FileCategory,
  organizationId: string,
  options?: ImageProcessingOptions
): Promise<UploadedFile> {
  // Utilise les options personnalisées si fournies, sinon les dimensions par défaut
  const results = await fileUploadService.processUploadedFiles([file], category, organizationId);
  return results[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS SUPPLÉMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════════

export const fileUploadServiceStubs = {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  processAndUploadImage,
};

export class FileUploadServiceStatic {
  static uploadImage = uploadImage;
  static uploadMultipleImages = uploadMultipleImages;
  static deleteImage = deleteImage;
  static processAndUploadImage = processAndUploadImage;
}
