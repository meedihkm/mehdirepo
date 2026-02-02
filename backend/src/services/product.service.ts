// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE PRODUITS
// Logique métier produits, catégories, stock
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, like, sql, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../database';
import { products, categories, stockMovements } from '../database/schema';
import { NotFoundError, ValidationError } from '../utils/errors';
import { cacheGetOrSet, cacheKeys, cacheDel } from '../cache';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CreateProductData {
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  unit: string;
  price: number;
  discountPrice?: number;
  discountEndDate?: Date;
  currentStock?: number;
  minStockLevel?: number;
  imageUrl?: string;
  createdBy?: string;
}

interface UpdateProductData {
  name?: string;
  description?: string;
  categoryId?: string;
  unit?: string;
  price?: number;
  discountPrice?: number | null;
  discountEndDate?: Date | null;
  minStockLevel?: number;
  imageUrl?: string;
  isActive?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const listProducts = async (
  organizationId: string,
  params: ListProductsParams
) => {
  const {
    page = 1,
    limit = 50,
    search,
    categoryId,
    isActive = true,
    sortBy = 'name',
    sortOrder = 'asc',
  } = params;

  const offset = (page - 1) * limit;

  // Construire les conditions
  const conditions = [eq(products.organizationId, organizationId)];

  if (typeof isActive === 'boolean') {
    conditions.push(eq(products.isActive, isActive));
  }

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  if (search) {
    conditions.push(
      sql`(${products.name} ILIKE ${'%' + search + '%'} OR ${products.sku} ILIKE ${'%' + search + '%'})`
    );
  }

  // Exécuter la requête
  const [data, countResult] = await Promise.all([
    db.query.products.findMany({
      where: and(...conditions),
      with: {
        category: true,
      },
      orderBy: sortOrder === 'desc' ? desc(products[sortBy as keyof typeof products]) : asc(products[sortBy as keyof typeof products]),
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions)),
  ]);

  const total = Number(countResult[0]?.count || 0);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS PAR CATÉGORIE (avec cache)
// ═══════════════════════════════════════════════════════════════════════════════

export const getProductsByCategory = async (
  organizationId: string,
  categoryId: string
) => {
  return cacheGetOrSet(
    cacheKeys.productsByCategory(organizationId, categoryId),
    async () => {
      return db.query.products.findMany({
        where: and(
          eq(products.organizationId, organizationId),
          eq(products.categoryId, categoryId),
          eq(products.isActive, true)
        ),
        orderBy: asc(products.name),
      });
    },
    300 // 5 minutes
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const getProductById = async (organizationId: string, productId: string) => {
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.organizationId, organizationId)
    ),
    with: {
      category: true,
    },
  });

  if (!product) {
    throw new NotFoundError('Produit introuvable');
  }

  return product;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const createProduct = async (
  organizationId: string,
  data: CreateProductData
) => {
  // Vérifier l'unicité du SKU
  const existingSku = await db.query.products.findFirst({
    where: and(
      eq(products.organizationId, organizationId),
      eq(products.sku, data.sku)
    ),
  });

  if (existingSku) {
    throw new ValidationError('Un produit avec ce SKU existe déjà');
  }

  // Vérifier que la catégorie existe
  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, data.categoryId),
      eq(categories.organizationId, organizationId)
    ),
  });

  if (!category) {
    throw new NotFoundError('Catégorie introuvable');
  }

  const productId = uuidv4();

  const [product] = await db
    .insert(products)
    .values({
      id: productId,
      organizationId,
      ...data,
      price: data.discountPrice || data.price,
    })
    .returning();

  // Enregistrer le mouvement de stock initial si un stock est défini
  if (data.currentStock && data.currentStock > 0) {
    await db.insert(stockMovements).values({
      organizationId,
      productId: product.id,
      type: 'initial',
      quantity: data.currentStock,
      previousStock: 0,
      newStock: data.currentStock,
      reason: 'Stock initial',
      createdBy: data.createdBy,
    });
  }

  return product;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const updateProduct = async (
  organizationId: string,
  productId: string,
  data: UpdateProductData
) => {
  const existingProduct = await getProductById(organizationId, productId);

  // Si changement de catégorie, vérifier qu'elle existe
  if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        eq(categories.organizationId, organizationId)
      ),
    });

    if (!category) {
      throw new NotFoundError('Catégorie introuvable');
    }
  }

  // Calculer le prix courant
  let price = existingProduct.price;
  if (data.price !== undefined || data.discountPrice !== undefined) {
    const basePrice = data.price ?? existingProduct.price;
    const discountPrice = data.discountPrice ?? existingProduct.discountPrice;
    price = discountPrice || basePrice;
  }

  const [product] = await db
    .update(products)
    .set({
      ...data,
      price,
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.id, productId), eq(products.organizationId, organizationId))
    )
    .returning();

  return product;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPRESSION PRODUIT (Soft delete)
// ═══════════════════════════════════════════════════════════════════════════════

export const deleteProduct = async (organizationId: string, productId: string) => {
  await getProductById(organizationId, productId);

  await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(products.id, productId), eq(products.organizationId, organizationId))
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export const updateStock = async (
  organizationId: string,
  productId: string,
  quantity: number,
  type: 'add' | 'remove' | 'set',
  reason?: string
) => {
  const product = await getProductById(organizationId, productId);

  let newQuantity: number;
  let movementType: string;

  switch (type) {
    case 'add':
      newQuantity = product.currentStock + quantity;
      movementType = 'receipt';
      break;
    case 'remove':
      newQuantity = Math.max(0, product.currentStock - quantity);
      movementType = 'withdrawal';
      break;
    case 'set':
      newQuantity = quantity;
      movementType = 'adjustment';
      break;
    default:
      throw new ValidationError('Type de mouvement invalide');
  }

  // Transaction pour assurer la cohérence
  const result = await db.transaction(async (tx) => {
    // Mettre à jour le stock
    const [updatedProduct] = await tx
      .update(products)
      .set({
        currentStock: newQuantity,
        updatedAt: new Date(),
      })
      .where(
        and(eq(products.id, productId), eq(products.organizationId, organizationId))
      )
      .returning();

    // Enregistrer le mouvement de stock
    await tx.insert(stockMovements).values({
      organizationId,
      productId,
      type: type === 'add' ? 'in' : type === 'remove' ? 'out' : 'adjustment',
      quantity: Math.abs(quantity),
      previousStock: product.currentStock,
      newStock: newQuantity,
      reason: reason || `Mouvement: ${type}`,
    });

    return updatedProduct;
  });

  return result;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR PRIX
// ═══════════════════════════════════════════════════════════════════════════════

export const updatePrice = async (
  organizationId: string,
  productId: string,
  data: {
    price?: number;
    discountPrice?: number | null;
    discountEndDate?: Date | null;
  }
) => {
  const product = await getProductById(organizationId, productId);

  const basePrice = data.price ?? product.price;
  const discountPrice = data.discountPrice ?? product.discountPrice;
  const price = discountPrice || basePrice;

  const [updatedProduct] = await db
    .update(products)
    .set({
      price: data.price,
      discountPrice: data.discountPrice,
      discountEndDate: data.discountEndDate,
      price,
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.id, productId), eq(products.organizationId, organizationId))
    )
    .returning();

  return updatedProduct;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR EN MASSE
// ═══════════════════════════════════════════════════════════════════════════════

export const bulkUpdate = async (
  organizationId: string,
  updates: Array<{ id: string; data: UpdateProductData }>
) => {
  const results = await db.transaction(async (tx) => {
    const updated = [];

    for (const { id, data } of updates) {
      const [product] = await tx
        .update(products)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
        .returning();

      if (product) {
        updated.push(product);
      }
    }

    return updated;
  });

  return {
    updated: results.length,
    products: results,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const listCategories = async (organizationId: string) => {
  return cacheGetOrSet(
    cacheKeys.categories(organizationId),
    async () => {
      return db.query.categories.findMany({
        where: eq(categories.organizationId, organizationId),
        orderBy: [asc(categories.sortOrder), asc(categories.name)],
        with: {
          products: {
            where: eq(products.isActive, true),
            columns: { id: true },
          },
        },
      });
    },
    600 // 10 minutes
  );
};

export const createCategory = async (
  organizationId: string,
  data: { name: string; description?: string; sortOrder?: number; imageUrl?: string }
) => {
  // Vérifier l'unicité du nom
  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.organizationId, organizationId),
      eq(categories.name, data.name)
    ),
  });

  if (existing) {
    throw new ValidationError('Une catégorie avec ce nom existe déjà');
  }

  const [category] = await db
    .insert(categories)
    .values({
      id: uuidv4(),
      organizationId,
      ...data,
    })
    .returning();

  return category;
};

export const updateCategory = async (
  organizationId: string,
  categoryId: string,
  data: { name?: string; description?: string; sortOrder?: number; imageUrl?: string }
) => {
  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, categoryId),
      eq(categories.organizationId, organizationId)
    ),
  });

  if (!existing) {
    throw new NotFoundError('Catégorie introuvable');
  }

  // Vérifier l'unicité du nom si modifié
  if (data.name && data.name !== existing.name) {
    const duplicate = await db.query.categories.findFirst({
      where: and(
        eq(categories.organizationId, organizationId),
        eq(categories.name, data.name)
      ),
    });

    if (duplicate) {
      throw new ValidationError('Une catégorie avec ce nom existe déjà');
    }
  }

  const [category] = await db
    .update(categories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(eq(categories.id, categoryId), eq(categories.organizationId, organizationId))
    )
    .returning();

  return category;
};

export const deleteCategory = async (organizationId: string, categoryId: string) => {
  // Vérifier qu'il n'y a pas de produits dans cette catégorie
  const productsInCategory = await db.query.products.findFirst({
    where: and(
      eq(products.categoryId, categoryId),
      eq(products.organizationId, organizationId),
      eq(products.isActive, true)
    ),
  });

  if (productsInCategory) {
    throw new ValidationError(
      'Impossible de supprimer une catégorie contenant des produits actifs'
    );
  }

  await db
    .delete(categories)
    .where(
      and(eq(categories.id, categoryId), eq(categories.organizationId, organizationId))
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const productService = {
  list: listProducts,
  getById: getProductById,
  create: createProduct,
  update: updateProduct,
  remove: deleteProduct,
  adjustStock: updateStock,
  reorder: listProducts, // Fallback - fonction reorderProducts à implémenter
  listCategories,
  createCategory,
  updateCategory,
  removeCategory: deleteCategory,
  getProductsByCategory,
  updatePrice,
  bulkUpdate,
};

export class ProductService {
  static list = listProducts;
  static getById = getProductById;
  static create = createProduct;
  static update = updateProduct;
  static remove = deleteProduct;
  static adjustStock = updateStock;
  static reorder = listProducts; // Fallback - fonction reorderProducts à implémenter
  static listCategories = listCategories;
  static createCategory = createCategory;
  static updateCategory = updateCategory;
  static removeCategory = deleteCategory;
  static getProductsByCategory = getProductsByCategory;
  static updatePrice = updatePrice;
  static bulkUpdate = bulkUpdate;
}

export default productService;
