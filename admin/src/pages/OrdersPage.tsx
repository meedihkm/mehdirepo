// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE COMMANDES (React Admin)
// Liste et gestion des commandes
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
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
  Tooltip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Search,
  Add,
  MoreVert,
  Visibility,
  LocalShipping,
  Check,
  Close,
  Print,
  Refresh,
  FilterList,
  DateRange,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
  status: OrderStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  totalAmount: number;
  paidAmount: number;
  itemCount: number;
  source: string;
  requestedDeliveryDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface OrderStats {
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  delivering: number;
  delivered: number;
  cancelled: number;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: any; icon: React.ReactNode }> = {
  draft: { label: 'Brouillon', color: 'default', icon: null },
  pending: { label: 'En attente', color: 'warning', icon: null },
  confirmed: { label: 'Confirmée', color: 'info', icon: <Check fontSize="small" /> },
  preparing: { label: 'En préparation', color: 'secondary', icon: null },
  ready: { label: 'Prête', color: 'primary', icon: null },
  delivering: { label: 'En livraison', color: 'info', icon: <LocalShipping fontSize="small" /> },
  delivered: { label: 'Livrée', color: 'success', icon: <Check fontSize="small" /> },
  cancelled: { label: 'Annulée', color: 'error', icon: <Close fontSize="small" /> },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // État local
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch] = useDebounce(search, 500);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('pending');
  const [currentTab, setCurrentTab] = useState(0);

  // Fetch commandes
  const { data, isLoading, isError, error, refetch } = useQuery<OrdersResponse>({
    queryKey: ['orders', debouncedSearch, page, rowsPerPage, orderBy, order, statusFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page + 1));
      params.set('limit', String(rowsPerPage));
      params.set('sortBy', orderBy);
      params.set('sortOrder', order);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (startDate) params.set('startDate', format(startDate, 'yyyy-MM-dd'));
      if (endDate) params.set('endDate', format(endDate, 'yyyy-MM-dd'));

      const response = await api.get(`/orders?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch stats par statut
  const { data: stats } = useQuery<OrderStats>({
    queryKey: ['orders', 'stats', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', format(startDate, 'yyyy-MM-dd'));
      if (endDate) params.set('endDate', format(endDate, 'yyyy-MM-dd'));
      
      const response = await api.get(`/orders/stats?${params.toString()}`);
      return response.data.data;
    },
  });

  // Mutation changement de statut
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      return api.patch(`/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setStatusDialogOpen(false);
      setSelectedOrder(null);
    },
  });

  // Handlers
  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    const statuses = ['', 'pending', 'confirmed,preparing,ready', 'delivering', 'delivered', 'cancelled'];
    setStatusFilter(statuses[newValue]);
    setPage(0);
  };

  const handleActionClick = (event: React.MouseEvent<HTMLElement>, orderItem: Order) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setSelectedOrder(orderItem);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
  };

  const handleViewOrder = () => {
    if (selectedOrder) {
      navigate(`/orders/${selectedOrder.id}`);
    }
    handleActionClose();
  };

  const handleChangeStatus = () => {
    if (selectedOrder) {
      setNewStatus(getNextStatus(selectedOrder.status));
      setStatusDialogOpen(true);
    }
    handleActionClose();
  };

  const handleStatusUpdate = () => {
    if (selectedOrder) {
      updateStatusMutation.mutate({ id: selectedOrder.id, status: newStatus });
    }
  };

  const handleAssignDelivery = () => {
    if (selectedOrder) {
      navigate(`/deliveries/assign?orderId=${selectedOrder.id}`);
    }
    handleActionClose();
  };

  const getNextStatus = (current: OrderStatus): OrderStatus => {
    const flow: Record<OrderStatus, OrderStatus> = {
      draft: 'pending',
      pending: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'delivering',
      delivering: 'delivered',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };
    return flow[current];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'admin':
        return 'Admin';
      case 'customer_app':
        return 'App Client';
      case 'phone':
        return 'Téléphone';
      default:
        return source;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box p={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight="bold">
            Commandes
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/orders/new')}
            >
              Nouvelle Commande
            </Button>
          </Box>
        </Box>

        {/* Onglets par statut */}
        <Card sx={{ mb: 3 }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label={
                <Badge badgeContent={stats?.total || 0} color="primary" max={999}>
                  Toutes
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={stats?.pending || 0} color="warning" max={999}>
                  En attente
                </Badge>
              }
            />
            <Tab
              label={
                <Badge
                  badgeContent={(stats?.confirmed || 0) + (stats?.preparing || 0) + (stats?.ready || 0)}
                  color="info"
                  max={999}
                >
                  En cours
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={stats?.delivering || 0} color="primary" max={999}>
                  En livraison
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={stats?.delivered || 0} color="success" max={999}>
                  Livrées
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={stats?.cancelled || 0} color="error" max={999}>
                  Annulées
                </Badge>
              }
            />
          </Tabs>
        </Card>

        {/* Filtres */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <TextField
                placeholder="Rechercher par n° commande, client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                sx={{ minWidth: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />

              <DatePicker
                label="Date début"
                value={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  setPage(0);
                }}
                slotProps={{ textField: { size: 'small' } }}
              />

              <DatePicker
                label="Date fin"
                value={endDate}
                onChange={(date) => {
                  setEndDate(date);
                  setPage(0);
                }}
                slotProps={{ textField: { size: 'small' } }}
              />

              <IconButton onClick={() => refetch()}>
                <Refresh />
              </IconButton>
            </Box>
          </CardContent>
        </Card>

        {/* Table */}
        <Paper>
          {isLoading && <LinearProgress />}

          {isError && (
            <Alert severity="error" sx={{ m: 2 }}>
              Erreur: {(error as Error).message}
            </Alert>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'orderNumber'}
                      direction={orderBy === 'orderNumber' ? order : 'asc'}
                      onClick={() => handleSort('orderNumber')}
                    >
                      N° Commande
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'createdAt'}
                      direction={orderBy === 'createdAt' ? order : 'asc'}
                      onClick={() => handleSort('createdAt')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell align="center">Articles</TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={orderBy === 'totalAmount'}
                      direction={orderBy === 'totalAmount' ? order : 'asc'}
                      onClick={() => handleSort('totalAmount')}
                    >
                      Montant
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">Statut</TableCell>
                  <TableCell align="center">Source</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.data.map((orderItem) => {
                  const statusConfig = STATUS_CONFIG[orderItem.status];
                  return (
                    <TableRow
                      key={orderItem.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/orders/${orderItem.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {orderItem.orderNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(orderItem.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {format(new Date(orderItem.createdAt), 'HH:mm', { locale: fr })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {orderItem.customer.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {orderItem.customer.code}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={orderItem.itemCount}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(orderItem.totalAmount)}
                        </Typography>
                        {orderItem.paidAmount > 0 && (
                          <Typography variant="caption" color="success.main">
                            Payé: {formatCurrency(orderItem.paidAmount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={statusConfig.label}
                          color={statusConfig.color}
                          size="small"
                          icon={statusConfig.icon as any}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {getSourceLabel(orderItem.source)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleActionClick(e, orderItem)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {data?.data.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">
                        Aucune commande trouvée
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={data?.pagination.total || 0}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="Lignes par page"
          />
        </Paper>

        {/* Menu Actions */}
        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={handleActionClose}
        >
          <MenuItem onClick={handleViewOrder}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            Voir détails
          </MenuItem>
          {selectedOrder && !['delivered', 'cancelled'].includes(selectedOrder.status) && (
            <MenuItem onClick={handleChangeStatus}>
              <Check fontSize="small" sx={{ mr: 1 }} />
              Changer statut
            </MenuItem>
          )}
          {selectedOrder?.status === 'ready' && (
            <MenuItem onClick={handleAssignDelivery}>
              <LocalShipping fontSize="small" sx={{ mr: 1 }} />
              Assigner livraison
            </MenuItem>
          )}
          <MenuItem onClick={handleActionClose}>
            <Print fontSize="small" sx={{ mr: 1 }} />
            Imprimer
          </MenuItem>
        </Menu>

        {/* Dialog Changement Statut */}
        <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
          <DialogTitle>Changer le statut de la commande</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Commande: {selectedOrder?.orderNumber}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Statut actuel:{' '}
              <Chip
                label={STATUS_CONFIG[selectedOrder?.status || 'pending'].label}
                color={STATUS_CONFIG[selectedOrder?.status || 'pending'].color}
                size="small"
              />
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Nouveau statut</InputLabel>
              <Select
                value={newStatus}
                label="Nouveau statut"
                onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'En cours...' : 'Confirmer'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default OrdersPage;
