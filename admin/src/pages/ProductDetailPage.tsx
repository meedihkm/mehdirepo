// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE DÉTAIL PRODUIT (React Admin)
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Inventory,
  TrendingUp,
  History,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { api } from '../api/client';

interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: { id: string; name: string };
  unit: string;
  basePrice: number;
  discountPrice?: number;
  currentPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  stats: {
    totalSold: number;
    totalRevenue: number;
    averageDaily: number;
  };
  stockHistory: Array<{
    id: string;
    type: string;
    quantity: number;
    reason?: string;
    createdAt: string;
  }>;
}

const ProductDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: product, isLoading, isError, error } = useQuery<ProductDetail>({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}`);
      return response.data.data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !product) {
    return (
      <Box p={3}>
        <Alert severity="error">{(error as Error)?.message || 'Produit non trouvé'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/products')} sx={{ mt: 2 }}>
          Retour
        </Button>
      </Box>
    );
  }

  const hasDiscount = product.discountPrice && product.discountPrice < product.basePrice;
  const stockStatus = product.stockQuantity === 0 ? 'Rupture' :
    product.stockQuantity <= product.minStockLevel ? 'Bas' : 'OK';

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/products')} sx={{ mb: 1 }}>
            Retour
          </Button>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              src={product.imageUrl}
              variant="rounded"
              sx={{ width: 64, height: 64 }}
            >
              {product.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight="bold">{product.name}</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="textSecondary">{product.sku}</Typography>
                <Chip label={product.category.name} size="small" variant="outlined" />
                <Chip
                  label={product.isActive ? 'Actif' : 'Inactif'}
                  color={product.isActive ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Box>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Edit />} onClick={() => navigate(`/products/${id}/edit`)}>
          Modifier
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Stats */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Total vendu</Typography>
                  <Typography variant="h4">{product.stats.totalSold}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Chiffre d'affaires</Typography>
                  <Typography variant="h6">{formatCurrency(product.stats.totalRevenue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Moyenne / jour</Typography>
                  <Typography variant="h4">{product.stats.averageDaily.toFixed(1)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Graphique ventes */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                Évolution des ventes
              </Typography>
              <Box height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { date: '01/01', quantity: 45 },
                      { date: '02/01', quantity: 52 },
                      { date: '03/01', quantity: 48 },
                      { date: '04/01', quantity: 61 },
                      { date: '05/01', quantity: 55 },
                      { date: '06/01', quantity: 67 },
                      { date: '07/01', quantity: 58 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="quantity" stroke="#8884d8" name="Quantité" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Historique stock */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <History sx={{ mr: 1, verticalAlign: 'middle' }} />
                Historique des mouvements
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Quantité</TableCell>
                      <TableCell>Raison</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {product.stockHistory?.slice(0, 10).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Chip
                            label={entry.type === 'add' ? 'Entrée' : entry.type === 'remove' ? 'Sortie' : 'Ajustement'}
                            size="small"
                            color={entry.type === 'add' ? 'success' : entry.type === 'remove' ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography color={entry.quantity > 0 ? 'success.main' : 'error.main'}>
                            {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell>{entry.reason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Prix */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Prix</Typography>
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">Prix de base</Typography>
                <Typography variant="h5">{formatCurrency(product.basePrice)}</Typography>
              </Box>
              {hasDiscount && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Prix promo</Typography>
                  <Typography variant="h5" color="error.main">
                    {formatCurrency(product.discountPrice!)}
                  </Typography>
                  <Chip
                    label={`-${(((product.basePrice - product.discountPrice!) / product.basePrice) * 100).toFixed(0)}%`}
                    color="error"
                    size="small"
                  />
                </Box>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="textSecondary">Unité de vente</Typography>
              <Typography variant="body1">{product.unit}</Typography>
            </CardContent>
          </Card>

          {/* Stock */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Inventory sx={{ mr: 1, verticalAlign: 'middle' }} />
                Stock
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="body2" color="textSecondary">Quantité actuelle</Typography>
                  <Typography
                    variant="h4"
                    color={stockStatus === 'Rupture' ? 'error.main' : stockStatus === 'Bas' ? 'warning.main' : 'success.main'}
                  >
                    {product.stockQuantity}
                  </Typography>
                </Box>
                <Chip label={stockStatus} color={stockStatus === 'Rupture' ? 'error' : stockStatus === 'Bas' ? 'warning' : 'success'} />
              </Box>
              <Typography variant="body2" color="textSecondary">Seuil minimum: {product.minStockLevel}</Typography>
            </CardContent>
          </Card>

          {/* Description */}
          {product.description && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Description</Typography>
                <Typography variant="body2">{product.description}</Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductDetailPage;
