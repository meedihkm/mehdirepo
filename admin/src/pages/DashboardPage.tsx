// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - DASHBOARD ADMIN (React)
// Tableau de bord principal avec KPIs
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ShoppingCart,
  LocalShipping,
  Payment,
  People,
  TrendingUp,
  TrendingDown,
  Warning,
  Refresh,
  ArrowForward,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardStats {
  today: {
    orders: number;
    revenue: number;
    deliveries: number;
    completedDeliveries: number;
    collections: number;
  };
  month: {
    orders: number;
    revenue: number;
    newCustomers: number;
    averageOrderValue: number;
  };
  totals: {
    totalDebt: number;
    activeCustomers: number;
    activeProducts: number;
    lowStockProducts: number;
  };
}

interface TopProduct {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface TopCustomer {
  id: string;
  name: string;
  revenue: number;
  orderCount: number;
}

interface DelivererPerformance {
  id: string;
  name: string;
  totalDeliveries: number;
  completedDeliveries: number;
  successRate: number;
  totalCollected: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  loading?: boolean;
}> = ({ title, value, subtitle, icon, color, trend, loading }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="textSecondary">
              {subtitle}
            </Typography>
          )}
          {trend !== undefined && (
            <Box display="flex" alignItems="center" mt={1}>
              {trend >= 0 ? (
                <TrendingUp color="success" fontSize="small" />
              ) : (
                <TrendingDown color="error" fontSize="small" />
              )}
              <Typography
                variant="body2"
                color={trend >= 0 ? 'success.main' : 'error.main'}
                ml={0.5}
              >
                {trend >= 0 ? '+' : ''}
                {trend.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}20`,
            borderRadius: 2,
            p: 1.5,
          }}
        >
          {React.cloneElement(icon as React.ReactElement, {
            sx: { color, fontSize: 32 },
          })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const DeliveryProgress: React.FC<{
  completed: number;
  total: number;
}> = ({ completed, total }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={1}>
        <Typography variant="body2">Livraisons du jour</Typography>
        <Typography variant="body2" fontWeight="bold">
          {completed}/{total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 10,
          borderRadius: 5,
          backgroundColor: '#e0e0e0',
          '& .MuiLinearProgress-bar': {
            borderRadius: 5,
            backgroundColor: percentage >= 80 ? '#4caf50' : '#ff9800',
          },
        }}
      />
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

const DashboardPage: React.FC = () => {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const response = await api.get('/dashboard/overview');
      return response.data.data;
    },
    refetchInterval: 60000, // Rafraîchir toutes les minutes
  });

  // Fetch top products
  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: ['dashboard', 'topProducts'],
    queryFn: async () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const response = await api.get('/dashboard/top-products', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          limit: 5,
        },
      });
      return response.data.data;
    },
  });

  // Fetch deliverer performance
  const { data: delivererPerformance } = useQuery<DelivererPerformance[]>({
    queryKey: ['dashboard', 'delivererPerformance'],
    queryFn: async () => {
      const today = new Date();
      const response = await api.get('/dashboard/deliverer-performance', {
        params: {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        },
      });
      return response.data.data;
    },
  });

  // Fetch stock alerts
  const { data: stockAlerts } = useQuery({
    queryKey: ['dashboard', 'stockAlerts'],
    queryFn: async () => {
      const response = await api.get('/dashboard/stock-alerts');
      return response.data.data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' DA';
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Tableau de bord
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </Typography>
        </Box>
        <Tooltip title="Rafraîchir">
          <IconButton onClick={() => refetch()}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Alertes stock */}
      {stockAlerts?.summary?.outOfStock > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Link to="/products?filter=lowStock">
              <IconButton size="small">
                <ArrowForward />
              </IconButton>
            </Link>
          }
        >
          <strong>{stockAlerts.summary.outOfStock}</strong> produit(s) en rupture de stock
          {stockAlerts.summary.critical > 0 && (
            <>, <strong>{stockAlerts.summary.critical}</strong> en stock critique</>
          )}
        </Alert>
      )}

      {/* KPIs principaux */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Commandes du jour"
            value={stats?.today.orders ?? '-'}
            subtitle={`Revenu: ${formatCurrency(stats?.today.revenue ?? 0)}`}
            icon={<ShoppingCart />}
            color="#1976d2"
            loading={statsLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Livraisons"
            value={`${stats?.today.completedDeliveries ?? 0}/${stats?.today.deliveries ?? 0}`}
            subtitle="Complétées / Total"
            icon={<LocalShipping />}
            color="#4caf50"
            loading={statsLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Encaissements"
            value={formatCurrency(stats?.today.collections ?? 0)}
            subtitle="Collecté aujourd'hui"
            icon={<Payment />}
            color="#ff9800"
            loading={statsLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Dette totale"
            value={formatCurrency(stats?.totals.totalDebt ?? 0)}
            subtitle={`${stats?.totals.activeCustomers ?? 0} clients actifs`}
            icon={<People />}
            color="#f44336"
            loading={statsLoading}
          />
        </Grid>
      </Grid>

      {/* Contenu principal */}
      <Grid container spacing={3}>
        {/* Progression livraisons */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance du mois
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="primary" fontWeight="bold">
                      {stats?.month.orders ?? 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Commandes
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="success.main" fontWeight="bold">
                      {formatCurrency(stats?.month.revenue ?? 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Chiffre d'affaires
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="secondary" fontWeight="bold">
                      {stats?.month.newCustomers ?? 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Nouveaux clients
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              <Box mt={3}>
                <DeliveryProgress
                  completed={stats?.today.completedDeliveries ?? 0}
                  total={stats?.today.deliveries ?? 0}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Alertes stock */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Alertes Stock</Typography>
                <Chip
                  icon={<Warning />}
                  label={stockAlerts?.summary?.outOfStock ?? 0}
                  color="error"
                  size="small"
                />
              </Box>
              {stockAlerts?.outOfStock?.slice(0, 5).map((product: any) => (
                <Box
                  key={product.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  py={1}
                  borderBottom="1px solid #eee"
                >
                  <Box>
                    <Typography variant="body2">{product.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {product.category?.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${product.stockQuantity} unités`}
                    size="small"
                    color={product.stockQuantity === 0 ? 'error' : 'warning'}
                  />
                </Box>
              ))}
              {(!stockAlerts?.outOfStock || stockAlerts.outOfStock.length === 0) && (
                <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
                  Aucune alerte de stock
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top produits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Produits du Mois
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produit</TableCell>
                    <TableCell align="right">Qté</TableCell>
                    <TableCell align="right">Revenu</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProducts?.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: ['#1976d2', '#4caf50', '#ff9800', '#9c27b0', '#f44336'][index],
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 'bold',
                              mr: 1,
                            }}
                          >
                            {index + 1}
                          </Box>
                          {product.name}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{product.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(product.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance livreurs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Livreurs (Aujourd'hui)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Livreur</TableCell>
                    <TableCell align="center">Livraisons</TableCell>
                    <TableCell align="center">Taux</TableCell>
                    <TableCell align="right">Encaissé</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delivererPerformance?.map((deliverer) => (
                    <TableRow key={deliverer.id}>
                      <TableCell>{deliverer.name}</TableCell>
                      <TableCell align="center">
                        {deliverer.completedDeliveries}/{deliverer.totalDeliveries}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${deliverer.successRate}%`}
                          size="small"
                          color={deliverer.successRate >= 80 ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(deliverer.totalCollected)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!delivererPerformance || delivererPerformance.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="textSecondary">
                          Aucune donnée disponible
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
