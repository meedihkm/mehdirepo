// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER PRODUITS
// CRUD produits, catégories, stock, prix
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import productService from '../services/product.service';
import { invalidateCache } from '../cache';

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  
  const result = await productService.listProducts(organizationId, req.query as any);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════════════════════════

export const getProductsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { categoryId } = req.params;

  const products = await productService.getProductsByCategory(organizationId, categoryId);

  res.json({
    success: true,
    data: products,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  const product = await productService.getProductById(organizationId, id);

  res.json({
    success: true,
    data: product,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const product = await productService.createProduct(organizationId, req.body);

  // Invalider le cache
  await invalidateCache.products(organizationId);

  res.status(201).json({
    success: true,
    data: product,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  const product = await productService.updateProduct(organizationId, id, req.body);

  // Invalider le cache
  await invalidateCache.products(organizationId);

  res.json({
    success: true,
    data: product,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPRESSION PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  await productService.deleteProduct(organizationId, id);

  // Invalider le cache
  await invalidateCache.products(organizationId);

  res.json({
    success: true,
    message: 'Produit désactivé avec succès',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;
  const { quantity, type, reason } = req.body;

  const product = await productService.updateStock(
    organizationId,
    id,
    quantity,
    type, // 'add' | 'remove' | 'set'
    reason
  );

  res.json({
    success: true,
    data: product,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR PRIX
// ═══════════════════════════════════════════════════════════════════════════════

export const updatePrice = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;
  const { basePrice, discountPrice, discountEndDate } = req.body;

  const product = await productService.updatePrice(organizationId, id, {
    basePrice,
    discountPrice,
    discountEndDate,
  });

  // Invalider le cache
  await invalidateCache.products(organizationId);

  res.json({
    success: true,
    data: product,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR EN MASSE
// ═══════════════════════════════════════════════════════════════════════════════

export const bulkUpdateProducts = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { products } = req.body;

  const result = await productService.bulkUpdate(organizationId, products);

  // Invalider le cache
  await invalidateCache.products(organizationId);

  res.json({
    success: true,
    data: result,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const categories = await productService.listCategories(organizationId);

  res.json({
    success: true,
    data: categories,
  });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const category = await productService.createCategory(organizationId, req.body);

  await invalidateCache.categories(organizationId);

  res.status(201).json({
    success: true,
    data: category,
  });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  const category = await productService.updateCategory(organizationId, id, req.body);

  await invalidateCache.categories(organizationId);

  res.json({
    success: true,
    data: category,
  });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  await productService.deleteCategory(organizationId, id);

  await invalidateCache.categories(organizationId);

  res.json({
    success: true,
    message: 'Catégorie supprimée avec succès',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STUBS pour compatibilité
// ═══════════════════════════════════════════════════════════════════════════════

export const reorderProducts = asyncHandler(async (req: Request, res: Response) => {
  // Stub - à implémenter
  res.json({
    success: true,
    message: 'Réorganisation des produits (stub)',
  });
});

// STUB - getProductById
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'getProductById (stub)',
    data: {}
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  listProducts,
  getProductsByCategory,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  updatePrice,
  bulkUpdateProducts,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
