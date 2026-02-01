// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE GESTION DES PRODUITS
// Liste, création, modification et suppression des produits
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  Alert,
  Snackbar,
  Skeleton,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  FilterList,
  CloudUpload,
  CloudDownload,
  Warning,
  Inventory,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { productsApi, categoriesApi } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: { id: string; name: string };
  unit: string;
  basePrice: number;
  discountPrice?: number;
  stockQuantity: number;
  minStockLevel: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

type SortField = 'name' | 'sku' | 'basePrice' | 'stockQuantity' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHÉMA DE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const productSchema = z.object({
  sku: z.string().min(3, 'SKU: minimum 3 caractères'),
  name: z.string().min(2, 'Nom: minimum 2 caractères'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Catégorie requise'),
  unit: z.string().min(1, 'Unité requise'),
  basePrice: z.coerce.number().min(0, 'Prix doit être positif'),
  discountPrice: z.coerce.number().min(0).optional().nullable(),
  stockQuantity: z.coerce.number().min(0, 'Stock doit être positif'),
  minStockLevel: z.coerce.number().min(0, 'Seuil doit être positif'),
  isActive: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
};

const getStockStatus = (current: number, min: number) => {
  if (current === 0) return { label: 'Rupture', color: 'error' as const };
  if (current <= min) return { label: 'Stock bas', color: 'warning' as const };
  return { label: 'En stock', color: 'success' as const };
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const ProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  
  // États locaux
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Requêtes
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', search, categoryFilter, stockFilter, page, rowsPerPage, sortField, sortOrder],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
        sortBy: sortField,
        sortOrder,
      };
      if (search) params.search = search;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (stockFilter === 'low') params.lowStock = true;
      if (stockFilter === 'out') params.outOfStock = true;

      const response = await productsApi.list(params);
      return response.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.list();
      return response.data.data as Category[];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDialogOpen(false);
      setSnackbar({ open: true, message: 'Produit créé avec succès', severity: 'success' });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.message || 'Erreur lors de la création', severity: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormData }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDialogOpen(false);
      setEditingProduct(null);
      setSnackbar({ open: true, message: 'Produit mis à jour', severity: 'success' });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.message || 'Erreur lors de la mise à jour', severity: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteConfirm(null);
      setSnackbar({ open: true, message: 'Produit supprimé', severity: 'success' });
    },
    onError: (error: any) => {
      setSnackbar({ open: true, message: error.message || 'Erreur lors de la suppression', severity: 'error' });
    },
  });

  // Handlers
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setDeleteConfirm(product);
  };

  const handleCreateNew = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  // Statistiques rapides
  const stats = useMemo(() => {
    if (!productsData?.data) return { total: 0, lowStock: 0, outOfStock: 0 };
    const products = productsData.data as Product[];
    return {
      total: productsData.pagination?.total || products.length,
      lowStock: products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel).length,
      outOfStock: products.filter(p => p.stockQuantity === 0).length,
    };
  }, [productsData]);

  return (
    <Box p={3}>
      {/* En-tête */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Produits
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CloudDownload />}
            onClick={() => {/* TODO: Export */}}
          >
            Exporter
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateNew}
          >
            Nouveau produit
          </Button>
        </Box>
      </Box>

      {/* Statistiques rapides */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
              <Inventory color="primary" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold">{stats.total}</Typography>
                <Typography variant="body2" color="textSecondary">Produits total</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
              <TrendingDown color="warning" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold" color="warning.main">{stats.lowStock}</Typography>
                <Typography variant="body2" color="textSecondary">Stock bas</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
              <Warning color="error" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold" color="error.main">{stats.outOfStock}</Typography>
                <Typography variant="body2" color="textSecondary">Rupture de stock</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtres */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher par nom ou SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={categoryFilter}
                label="Catégorie"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">Toutes</MenuItem>
                {categories?.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Stock</InputLabel>
              <Select
                value={stockFilter}
                label="Stock"
                onChange={(e) => setStockFilter(e.target.value as any)}
              >
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="low">Stock bas</MenuItem>
                <MenuItem value="out">Rupture</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'sku'}
                  direction={sortField === 'sku' ? sortOrder : 'asc'}
                  onClick={() => handleSort('sku')}
                >
                  SKU
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortOrder : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Nom
                </TableSortLabel>
              </TableCell>
              <TableCell>Catégorie</TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === 'basePrice'}
                  direction={sortField === 'basePrice' ? sortOrder : 'asc'}
                  onClick={() => handleSort('basePrice')}
                >
                  Prix
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={sortField === 'stockQuantity'}
                  direction={sortField === 'stockQuantity' ? sortOrder : 'asc'}
                  onClick={() => handleSort('stockQuantity')}
                >
                  Stock
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productsLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => (
                    <TableCell key={j}><Skeleton /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : productsData?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">Aucun produit trouvé</Typography>
                </TableCell>
              </TableRow>
            ) : (
              productsData?.data?.map((product: Product) => {
                const stockStatus = getStockStatus(product.stockQuantity, product.minStockLevel);
                return (
                  <TableRow key={product.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {product.sku}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography fontWeight="medium">{product.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {product.unit}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{product.category?.name || '-'}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="medium">
                        {formatCurrency(product.basePrice)}
                      </Typography>
                      {product.discountPrice && (
                        <Typography variant="caption" color="success.main">
                          Promo: {formatCurrency(product.discountPrice)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box>
                        <Typography fontWeight="medium">{product.stockQuantity}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          Min: {product.minStockLevel}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={stockStatus.label}
                        color={stockStatus.color}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => handleEdit(product)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => handleDelete(product)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={productsData?.pagination?.total || 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Par page"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </TableContainer>

      {/* Dialog Création/Modification */}
      <ProductDialog
        open={dialogOpen}
        product={editingProduct}
        categories={categories || []}
        onClose={() => {
          setDialogOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={(data) => {
          if (editingProduct) {
            updateMutation.mutate({ id: editingProduct.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog Confirmation Suppression */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Supprimer le produit ?</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirm?.name}</strong> ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button
            color="error"
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            disabled={deleteMutation.isPending}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductDialogProps {
  open: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  isLoading: boolean;
}

const ProductDialog: React.FC<ProductDialogProps> = ({
  open,
  product,
  categories,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      categoryId: '',
      unit: 'pièce',
      basePrice: 0,
      discountPrice: null,
      stockQuantity: 0,
      minStockLevel: 10,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        categoryId: product.categoryId,
        unit: product.unit,
        basePrice: product.basePrice,
        discountPrice: product.discountPrice || null,
        stockQuantity: product.stockQuantity,
        minStockLevel: product.minStockLevel,
        isActive: product.isActive,
      });
    } else {
      reset({
        sku: '',
        name: '',
        description: '',
        categoryId: '',
        unit: 'pièce',
        basePrice: 0,
        discountPrice: null,
        stockQuantity: 0,
        minStockLevel: 10,
        isActive: true,
      });
    }
  }, [product, reset]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {product ? 'Modifier le produit' : 'Nouveau produit'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="sku"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="SKU *"
                    error={!!errors.sku}
                    helperText={errors.sku?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Nom *"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="Description"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.categoryId}>
                    <InputLabel>Catégorie *</InputLabel>
                    <Select {...field} label="Catégorie *">
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Unité *</InputLabel>
                    <Select {...field} label="Unité *">
                      <MenuItem value="pièce">Pièce</MenuItem>
                      <MenuItem value="kg">Kilogramme</MenuItem>
                      <MenuItem value="litre">Litre</MenuItem>
                      <MenuItem value="boîte">Boîte</MenuItem>
                      <MenuItem value="pack">Pack</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="basePrice"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Prix de base (DA) *"
                    error={!!errors.basePrice}
                    helperText={errors.basePrice?.message}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="discountPrice"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Prix promo (DA)"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="stockQuantity"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Quantité en stock *"
                    error={!!errors.stockQuantity}
                    helperText={errors.stockQuantity?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="minStockLevel"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Seuil d'alerte *"
                    error={!!errors.minStockLevel}
                    helperText={errors.minStockLevel?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={field.onChange} />}
                    label="Produit actif (visible dans le catalogue)"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {product ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ProductsPage;
