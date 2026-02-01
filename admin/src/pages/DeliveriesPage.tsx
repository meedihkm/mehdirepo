// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE LIVRAISONS (React Admin)
// Assignation et suivi des livraisons
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Avatar,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  LocalShipping,
  Person,
  Phone,
  LocationOn,
  Check,
  Close,
  Refresh,
  Assignment,
  Map,
  Timer,
  AttachMoney,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type DeliveryStatus = 'pending' | 'assigned' | 'in_transit' | 'arrived' | 'completed' | 'failed';

interface Delivery {
  id: string;
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
  };
  deliverer?: {
    id: string;
    name: string;
    phone: string;
  };
  status: DeliveryStatus;
  scheduledDate: string;
  sortOrder: number;
  startedAt?: string;
  completedAt?: string;
  amountCollected?: number;
  collectionMode?: string;
  failureReason?: string;
}

interface Deliverer {
  id: string;
  name: string;
  phone: string;
  isAvailable: boolean;
  todayStats: {
    assigned: number;
    completed: number;
    totalCollected: number;
  };
}

interface OrderToAssign {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    address: string;
    phone: string;
  };
  totalAmount: number;
  paidAmount: number;
  requestedDeliveryDate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: any }> = {
  pending: { label: 'En attente', color: 'default' },
  assigned: { label: 'Assignée', color: 'info' },
  in_transit: { label: 'En cours', color: 'primary' },
  arrived: { label: 'Arrivé', color: 'secondary' },
  completed: { label: 'Terminée', color: 'success' },
  failed: { label: 'Échouée', color: 'error' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const DeliveriesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // État
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDelivererId, setSelectedDelivererId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState(0);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [assignToDeliverer, setAssignToDeliverer] = useState<string>('');

  // Fetch livreurs
  const { data: deliverers } = useQuery<Deliverer[]>({
    queryKey: ['deliverers', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await api.get('/users/deliverers', {
        params: { date: format(selectedDate, 'yyyy-MM-dd') },
      });
      return response.data.data;
    },
  });

  // Fetch livraisons
  const { data: deliveries, isLoading, refetch } = useQuery<Delivery[]>({
    queryKey: ['deliveries', format(selectedDate, 'yyyy-MM-dd'), selectedDelivererId],
    queryFn: async () => {
      const params: any = { date: format(selectedDate, 'yyyy-MM-dd') };
      if (selectedDelivererId) params.delivererId = selectedDelivererId;
      
      const response = await api.get('/deliveries', { params });
      return response.data.data;
    },
  });

  // Fetch commandes prêtes à assigner
  const { data: ordersToAssign } = useQuery<OrderToAssign[]>({
    queryKey: ['orders', 'ready', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await api.get('/orders', {
        params: { 
          status: 'ready',
          requestedDeliveryDate: format(selectedDate, 'yyyy-MM-dd'),
        },
      });
      return response.data.data;
    },
    enabled: assignDialogOpen,
  });

  // Mutation assignation
  const assignMutation = useMutation({
    mutationFn: async ({ delivererId, orderIds }: { delivererId: string; orderIds: string[] }) => {
      return api.post('/deliveries/assign', {
        delivererId,
        orderIds,
        date: format(selectedDate, 'yyyy-MM-dd'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['deliverers'] });
      setAssignDialogOpen(false);
      setSelectedOrders([]);
      setAssignToDeliverer('');
    },
  });

  // Stats par statut
  const stats = useMemo(() => {
    if (!deliveries) return null;
    return {
      total: deliveries.length,
      pending: deliveries.filter(d => d.status === 'pending' || d.status === 'assigned').length,
      inProgress: deliveries.filter(d => d.status === 'in_transit' || d.status === 'arrived').length,
      completed: deliveries.filter(d => d.status === 'completed').length,
      failed: deliveries.filter(d => d.status === 'failed').length,
      totalCollected: deliveries
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + (d.amountCollected || 0), 0),
    };
  }, [deliveries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    // Filter by tab
  };

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleAssign = () => {
    if (assignToDeliverer && selectedOrders.length > 0) {
      assignMutation.mutate({
        delivererId: assignToDeliverer,
        orderIds: selectedOrders,
      });
    }
  };

  // Filtrer les livraisons par onglet
  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return [];
    switch (currentTab) {
      case 1: // En attente
        return deliveries.filter(d => ['pending', 'assigned'].includes(d.status));
      case 2: // En cours
        return deliveries.filter(d => ['in_transit', 'arrived'].includes(d.status));
      case 3: // Terminées
        return deliveries.filter(d => d.status === 'completed');
      case 4: // Échouées
        return deliveries.filter(d => d.status === 'failed');
      default:
        return deliveries;
    }
  }, [deliveries, currentTab]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box p={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight="bold">
            Livraisons
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<Assignment />}
              onClick={() => setAssignDialogOpen(true)}
            >
              Assigner des livraisons
            </Button>
          </Box>
        </Box>

        {/* Filtres */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <DatePicker
                label="Date"
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                slotProps={{ textField: { size: 'small' } }}
              />

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Livreur</InputLabel>
                <Select
                  value={selectedDelivererId}
                  label="Livreur"
                  onChange={(e) => setSelectedDelivererId(e.target.value)}
                >
                  <MenuItem value="">Tous les livreurs</MenuItem>
                  {deliverers?.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <IconButton onClick={() => refetch()}>
                <Refresh />
              </IconButton>
            </Box>
          </CardContent>
        </Card>

        {/* Stats */}
        {stats && (
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Total</Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Terminées</Typography>
                  <Typography variant="h4" color="success.main">{stats.completed}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">En cours</Typography>
                  <Typography variant="h4" color="primary.main">{stats.inProgress}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="textSecondary">Encaissé</Typography>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(stats.totalCollected)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Onglets */}
        <Card sx={{ mb: 3 }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label={<Badge badgeContent={stats?.total} color="primary">Toutes</Badge>} />
            <Tab label={<Badge badgeContent={stats?.pending} color="warning">En attente</Badge>} />
            <Tab label={<Badge badgeContent={stats?.inProgress} color="info">En cours</Badge>} />
            <Tab label={<Badge badgeContent={stats?.completed} color="success">Terminées</Badge>} />
            <Tab label={<Badge badgeContent={stats?.failed} color="error">Échouées</Badge>} />
          </Tabs>
        </Card>

        {/* Liste des livraisons */}
        <Paper>
          {isLoading && <LinearProgress />}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Commande</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Livreur</TableCell>
                  <TableCell align="right">Montant</TableCell>
                  <TableCell align="center">Statut</TableCell>
                  <TableCell>Heure</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDeliveries.map((delivery) => {
                  const statusConfig = STATUS_CONFIG[delivery.status];
                  const remainingToPay = delivery.order.totalAmount - delivery.order.paidAmount;

                  return (
                    <TableRow key={delivery.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {delivery.order.orderNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {delivery.customer.name}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Phone fontSize="small" color="action" sx={{ fontSize: 14 }} />
                            <Typography variant="caption" color="textSecondary">
                              {delivery.customer.phone}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {delivery.deliverer ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ width: 28, height: 28 }}>
                              {delivery.deliverer.name.charAt(0)}
                            </Avatar>
                            <Typography variant="body2">
                              {delivery.deliverer.name}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            Non assigné
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(delivery.order.totalAmount)}
                        </Typography>
                        {remainingToPay > 0 && (
                          <Typography variant="caption" color="error.main">
                            Reste: {formatCurrency(remainingToPay)}
                          </Typography>
                        )}
                        {delivery.amountCollected !== undefined && delivery.amountCollected > 0 && (
                          <Typography variant="caption" color="success.main" display="block">
                            Encaissé: {formatCurrency(delivery.amountCollected)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={statusConfig.label}
                          color={statusConfig.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {delivery.completedAt ? (
                          <Typography variant="caption">
                            {format(new Date(delivery.completedAt), 'HH:mm')}
                          </Typography>
                        ) : delivery.startedAt ? (
                          <Typography variant="caption" color="primary.main">
                            Départ: {format(new Date(delivery.startedAt), 'HH:mm')}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="textSecondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredDeliveries.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <LocalShipping sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                      <Typography color="textSecondary">
                        Aucune livraison pour cette date
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Dialog Assignation */}
        <Dialog 
          open={assignDialogOpen} 
          onClose={() => setAssignDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Assigner des livraisons</DialogTitle>
          <DialogContent>
            <Grid container spacing={3}>
              {/* Sélection livreur */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Livreur
                </Typography>
                <List>
                  {deliverers?.filter(d => d.isAvailable).map((deliverer) => (
                    <ListItem
                      key={deliverer.id}
                      button
                      selected={assignToDeliverer === deliverer.id}
                      onClick={() => setAssignToDeliverer(deliverer.id)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemAvatar>
                        <Avatar>{deliverer.name.charAt(0)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={deliverer.name}
                        secondary={`${deliverer.todayStats.assigned} assignées`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>

              {/* Sélection commandes */}
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle2" gutterBottom>
                  Commandes à assigner ({selectedOrders.length} sélectionnées)
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <List>
                    {ordersToAssign?.map((order) => (
                      <React.Fragment key={order.id}>
                        <ListItem>
                          <Checkbox
                            edge="start"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => handleToggleOrder(order.id)}
                          />
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2" fontWeight="bold">
                                  {order.orderNumber}
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {formatCurrency(order.totalAmount)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {order.customer.name}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {order.customer.address}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))}

                    {ordersToAssign?.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary="Aucune commande prête à livrer"
                          secondary="Les commandes au statut 'Prête' apparaîtront ici"
                        />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleAssign}
              disabled={
                assignMutation.isPending ||
                !assignToDeliverer ||
                selectedOrders.length === 0
              }
            >
              {assignMutation.isPending
                ? 'En cours...'
                : `Assigner ${selectedOrders.length} commande(s)`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default DeliveriesPage;
