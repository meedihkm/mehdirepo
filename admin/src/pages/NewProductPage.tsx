// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE CRÉATION/ÉDITION PRODUIT (React Admin)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  InputAdornment,
  CircularProgress,
  Divider,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { api } from '../api/client';

// Validation
const productSchema = z.object({
  sku: z.string().min(1, 'SKU requis'),
  name: z.string().min(2, 'Nom requis'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Catégorie requise'),
  unit: z.string().min(1, 'Unité requise'),
  basePrice: z.number().min(0, 'Prix invalide'),
  discountPrice: z.number().min(0).optional(),
  stockQuantity: z.number().min(0),
  minStockLevel: z.number().min(0),
  isActive: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Category {
  id: string;
  name: string;
}

const NewProductPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const isEditing = Boolean(id);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      categoryId: '',
      unit: 'pièce',
      basePrice: 0,
      discountPrice: undefined,
      stockQuantity: 0,
      minStockLevel: 10,
      isActive: true,
    },
  });

  // Fetch catégories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data.data;
    },
  });

  // Fetch produit existant
  const { data: existingProduct, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}`);
      return response.data.data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingProduct) {
      reset({
        sku: existingProduct.sku,
        name: existingProduct.name,
        description: existingProduct.description || '',
        categoryId: existingProduct.category.id,
        unit: existingProduct.unit,
        basePrice: existingProduct.basePrice,
        discountPrice: existingProduct.discountPrice || undefined,
        stockQuantity: existingProduct.stockQuantity,
        minStockLevel: existingProduct.minStockLevel,
        isActive: existingProduct.isActive,
      });
    }
  }, [existingProduct, reset]);

  // Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (isEditing) {
        return api.patch(`/products/${id}`, data);
      }
      return api.post('/products', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      enqueueSnackbar(isEditing ? 'Produit modifié' : 'Produit créé', { variant: 'success' });
      navigate('/products');
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    saveMutation.mutate(data);
  };

  if (isEditing && isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/products')}>
          Retour
        </Button>
        <Typography variant="h5" fontWeight="bold">
          {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Informations générales</Typography>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
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
                          disabled={isEditing}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Nom du produit *"
                          error={!!errors.name}
                          helperText={errors.name?.message}
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
                            {categories?.map((cat) => (
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
                            <MenuItem value="g">Gramme</MenuItem>
                            <MenuItem value="litre">Litre</MenuItem>
                            <MenuItem value="paquet">Paquet</MenuItem>
                            <MenuItem value="boîte">Boîte</MenuItem>
                          </Select>
                        </FormControl>
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
                          label="Description"
                          multiline
                          rows={3}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Prix</Typography>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="basePrice"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Prix de base *"
                          type="number"
                          error={!!errors.basePrice}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                          }}
                          onChange={(e) => field.onChange(Number(e.target.value))}
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
                          label="Prix promotionnel"
                          type="number"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                          }}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          value={field.value || ''}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Stock</Typography>
                <Divider sx={{ mb: 3 }} />

                <Controller
                  name="stockQuantity"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Quantité en stock"
                      type="number"
                      sx={{ mb: 2 }}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
                <Controller
                  name="minStockLevel"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Seuil d'alerte"
                      type="number"
                      helperText="Alerte quand le stock descend en dessous"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Statut</Typography>
                <Divider sx={{ mb: 3 }} />

                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      }
                      label="Produit actif"
                    />
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  type="submit"
                  disabled={saveMutation.isPending}
                  startIcon={saveMutation.isPending ? <CircularProgress size={20} /> : <Save />}
                >
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/products')}
                >
                  Annuler
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default NewProductPage;
