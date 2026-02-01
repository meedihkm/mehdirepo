// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE DÉTAIL CLIENT (React Admin)
// Fiche client avec historique et statistiques
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Phone,
  Email,
  LocationOn,
  ShoppingCart,
  Receipt,
  TrendingUp,
  CreditCard,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerDetail {
  id: string;
  code: string;
  name: string;
  phone: string;
  phone2?: string;
  email?: string;
  address: string;
  city?: string;
  wilaya?: string;
  category: 'normal' | 'vip' | 'wholesale';
  currentDebt: number;
  creditLimit?: number;
  creditLimitEnabled: boolean;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    lastOrderDate?: string;
  };
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
}

interface StatementEntry {
  id: string;
  date: string;
  type: 'order' | 'payment';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const CustomerDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [currentTab, setCurrentTab] = useState(0);

  // Fetch client
  const { data: customer, isLoading, isError, error } = useQuery<CustomerDetail>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}`);
      return response.data.data;
    },
  });

  // Fetch commandes récentes
  const { data: recentOrders } = useQuery<OrderSummary[]>({
    queryKey: ['customer', id, 'orders'],
    queryFn: async () => {
      const response = await api.get(`/orders`, {
        params: { customerId: id, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' },
      });
      return response.data.data;
    },
    enabled: currentTab === 1,
  });

  // Fetch relevé de compte
  const { data: statement } = useQuery<StatementEntry[]>({
    queryKey: ['customer', id, 'statement'],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      
      const response = await api.get(`/customers/${id}/statement`, {
        params: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
        },
      });
      return response.data.data.movements;
    },
    enabled: currentTab === 2,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'vip': return 'warning';
      case 'wholesale': return 'info';
      default: return 'default';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'vip': return 'VIP';
      case 'wholesale': return 'Grossiste';
      default: return 'Normal';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !customer) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {(error as Error)?.message || 'Client non trouvé'}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/customers')} sx={{ mt: 2 }}>
          Retour aux clients
        </Button>
      </Box>
    );
  }

  const creditUsage = customer.creditLimitEnabled && customer.creditLimit
    ? (customer.currentDebt / customer.creditLimit) * 100
    : 0;

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/customers')} sx={{ mb: 1 }}>
            Retour
          </Button>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 24 }}>
              {customer.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight="bold">
                {customer.name}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="textSecondary">
                  {customer.code}
                </Typography>
                <Chip
                  label={getCategoryLabel(customer.category)}
                  color={getCategoryColor(customer.category) as any}
                  size="small"
                />
                <Chip
                  label={customer.isActive ? 'Actif' : 'Inactif'}
                  color={customer.isActive ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Box>
          </Box>
        </Box>

        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={<ShoppingCart />}
            onClick={() => navigate(`/orders/new?customerId=${id}`)}
          >
            Nouvelle commande
          </Button>
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => navigate(`/customers/${id}/edit`)}
          >
            Modifier
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Colonne principale */}
        <Grid item xs={12} md={8}>
          {/* Onglets */}
          <Card sx={{ mb: 3 }}>
            <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
              <Tab label="Aperçu" />
              <Tab label="Commandes" />
              <Tab label="Relevé de compte" />
            </Tabs>
          </Card>

          {/* Contenu onglet Aperçu */}
          {currentTab === 0 && (
            <>
              {/* Statistiques */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={6} sm={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="textSecondary">
                        Total commandes
                      </Typography>
                      <Typography variant="h4">{customer.stats.totalOrders}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="textSecondary">
                        Chiffre d'affaires
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(customer.stats.totalRevenue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="textSecondary">
                        Panier moyen
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(customer.stats.averageOrderValue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="textSecondary">
                        Dernière commande
                      </Typography>
                      <Typography variant="h6">
                        {customer.stats.lastOrderDate
                          ? format(new Date(customer.stats.lastOrderDate), 'dd/MM/yy')
                          : 'Aucune'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Graphique évolution */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Évolution des commandes
                  </Typography>
                  <Box height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[
                          { month: 'Oct', orders: 12, revenue: 45000 },
                          { month: 'Nov', orders: 15, revenue: 52000 },
                          { month: 'Déc', orders: 18, revenue: 68000 },
                          { month: 'Jan', orders: 14, revenue: 48000 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#8884d8" name="Commandes" />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" name="CA" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </>
          )}

          {/* Contenu onglet Commandes */}
          {currentTab === 1 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Commandes récentes
                </Typography>
                {recentOrders && recentOrders.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>N° Commande</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Statut</TableCell>
                          <TableCell align="right">Montant</TableCell>
                          <TableCell align="right">Payé</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            <TableCell>
                              <Typography fontWeight="medium">
                                {order.orderNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {format(new Date(order.createdAt), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              <Chip label={order.status} size="small" />
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(order.totalAmount)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                color={order.paidAmount >= order.totalAmount ? 'success.main' : 'warning.main'}
                              >
                                {formatCurrency(order.paidAmount)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="textSecondary">Aucune commande</Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contenu onglet Relevé */}
          {currentTab === 2 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Relevé de compte (3 derniers mois)
                </Typography>
                {statement && statement.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Référence</TableCell>
                          <TableCell align="right">Débit</TableCell>
                          <TableCell align="right">Crédit</TableCell>
                          <TableCell align="right">Solde</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {statement.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              {format(new Date(entry.date), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={entry.type === 'order' ? 'Commande' : 'Paiement'}
                                size="small"
                                color={entry.type === 'order' ? 'default' : 'success'}
                              />
                              {' '}{entry.reference}
                            </TableCell>
                            <TableCell align="right">
                              {entry.debit > 0 && (
                                <Typography color="error.main">
                                  {formatCurrency(entry.debit)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {entry.credit > 0 && (
                                <Typography color="success.main">
                                  {formatCurrency(entry.credit)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">
                                {formatCurrency(entry.balance)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography color="textSecondary">Aucun mouvement</Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Colonne latérale */}
        <Grid item xs={12} md={4}>
          {/* Coordonnées */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Coordonnées</Typography>
              <List dense>
                <ListItem>
                  <Phone sx={{ mr: 2 }} color="action" />
                  <ListItemText
                    primary={customer.phone}
                    secondary={customer.phone2 || null}
                  />
                </ListItem>
                {customer.email && (
                  <ListItem>
                    <Email sx={{ mr: 2 }} color="action" />
                    <ListItemText primary={customer.email} />
                  </ListItem>
                )}
                <ListItem>
                  <LocationOn sx={{ mr: 2 }} color="action" />
                  <ListItemText
                    primary={customer.address}
                    secondary={[customer.city, customer.wilaya].filter(Boolean).join(', ')}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Crédit */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <CreditCard sx={{ mr: 1, verticalAlign: 'middle' }} />
                Crédit
              </Typography>

              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">Dette actuelle</Typography>
                <Typography
                  variant="h4"
                  color={customer.currentDebt > 0 ? 'error.main' : 'success.main'}
                >
                  {formatCurrency(customer.currentDebt)}
                </Typography>
              </Box>

              {customer.creditLimitEnabled && customer.creditLimit ? (
                <>
                  <Box mb={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Limite: {formatCurrency(customer.creditLimit)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {creditUsage.toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(creditUsage, 100)}
                      color={creditUsage > 80 ? 'error' : creditUsage > 50 ? 'warning' : 'primary'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Typography variant="body2">
                    Disponible:{' '}
                    <strong>
                      {formatCurrency(Math.max(0, customer.creditLimit - customer.currentDebt))}
                    </strong>
                  </Typography>
                </>
              ) : (
                <Chip label="Crédit illimité" color="info" size="small" />
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {customer.notes && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Notes</Typography>
                <Typography variant="body2" color="textSecondary">
                  {customer.notes}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerDetailPage;
