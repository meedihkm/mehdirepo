// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE CLIENTS (React Admin)
// Liste et gestion des clients
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
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
  Avatar,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Search,
  Add,
  MoreVert,
  Edit,
  Visibility,
  Phone,
  LocationOn,
  CreditCard,
  FilterList,
  Download,
  Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  city?: string;
  wilaya?: string;
  currentDebt: number;
  creditLimit?: number;
  creditLimitEnabled: boolean;
  category: 'normal' | 'vip' | 'wholesale';
  isActive: boolean;
  totalOrders: number;
  totalRevenue: number;
  createdAt: string;
}

interface CustomersResponse {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // État local
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch] = useDebounce(search, 500);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [orderBy, setOrderBy] = useState<keyof Customer>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || '');
  const [debtFilter, setDebtFilter] = useState<string>(searchParams.get('hasDebt') || '');
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);

  // Fetch clients
  const { data, isLoading, isError, error, refetch } = useQuery<CustomersResponse>({
    queryKey: ['customers', debouncedSearch, page, rowsPerPage, orderBy, order, categoryFilter, debtFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page + 1));
      params.set('limit', String(rowsPerPage));
      params.set('sortBy', orderBy);
      params.set('sortOrder', order);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (categoryFilter) params.set('category', categoryFilter);
      if (debtFilter) params.set('hasDebt', debtFilter);

      const response = await api.get(`/customers?${params.toString()}`);
      return response.data;
    },
  });

  // Mutation mise à jour limite crédit
  const updateCreditMutation = useMutation({
    mutationFn: async ({ id, creditLimit }: { id: string; creditLimit: number }) => {
      return api.patch(`/customers/${id}/credit`, { creditLimit, creditLimitEnabled: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setCreditDialogOpen(false);
      setSelectedCustomer(null);
    },
  });

  // Handlers
  const handleSort = (property: keyof Customer) => {
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

  const handleActionClick = (event: React.MouseEvent<HTMLElement>, customer: Customer) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedCustomer(customer);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
  };

  const handleViewCustomer = () => {
    if (selectedCustomer) {
      navigate(`/customers/${selectedCustomer.id}`);
    }
    handleActionClose();
  };

  const handleEditCustomer = () => {
    if (selectedCustomer) {
      navigate(`/customers/${selectedCustomer.id}/edit`);
    }
    handleActionClose();
  };

  const handleEditCredit = () => {
    if (selectedCustomer) {
      setNewCreditLimit(selectedCustomer.creditLimit || 0);
      setCreditDialogOpen(true);
    }
    handleActionClose();
  };

  const handleCreditUpdate = () => {
    if (selectedCustomer) {
      updateCreditMutation.mutate({ id: selectedCustomer.id, creditLimit: newCreditLimit });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'vip':
        return 'warning';
      case 'wholesale':
        return 'info';
      default:
        return 'default';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'vip':
        return 'VIP';
      case 'wholesale':
        return 'Grossiste';
      default:
        return 'Normal';
    }
  };

  // Stats résumé
  const summary = useMemo(() => {
    if (!data?.data) return null;
    const customers = data.data;
    return {
      total: data.pagination.total,
      withDebt: customers.filter(c => c.currentDebt > 0).length,
      totalDebt: customers.reduce((sum, c) => sum + c.currentDebt, 0),
    };
  }, [data]);

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Clients
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => {/* TODO: Export */}}
          >
            Exporter
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/customers/new')}
          >
            Nouveau Client
          </Button>
        </Box>
      </Box>

      {/* Résumé */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Total Clients
                </Typography>
                <Typography variant="h4">{summary.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Clients avec Dette
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summary.withDebt}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary">
                  Dette Totale
                </Typography>
                <Typography variant="h4" color="error.main">
                  {formatCurrency(summary.totalDebt)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              placeholder="Rechercher par nom, code, téléphone..."
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

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={categoryFilter}
                label="Catégorie"
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Toutes</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="vip">VIP</MenuItem>
                <MenuItem value="wholesale">Grossiste</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Dette</InputLabel>
              <Select
                value={debtFilter}
                label="Dette"
                onChange={(e) => {
                  setDebtFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="true">Avec dette</MenuItem>
                <MenuItem value="false">Sans dette</MenuItem>
              </Select>
            </FormControl>

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
                    active={orderBy === 'code'}
                    direction={orderBy === 'code' ? order : 'asc'}
                    onClick={() => handleSort('code')}
                  >
                    Code
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'name'}
                    direction={orderBy === 'name' ? order : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Client
                  </TableSortLabel>
                </TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'currentDebt'}
                    direction={orderBy === 'currentDebt' ? order : 'asc'}
                    onClick={() => handleSort('currentDebt')}
                  >
                    Dette
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Limite Crédit</TableCell>
                <TableCell align="center">Statut</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.data.map((customer) => (
                <TableRow
                  key={customer.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {customer.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                        {customer.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {customer.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {customer.city || customer.wilaya || '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Phone fontSize="small" color="action" />
                      <Typography variant="body2">{customer.phone}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryLabel(customer.category)}
                      color={getCategoryColor(customer.category) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      color={customer.currentDebt > 0 ? 'error.main' : 'text.primary'}
                    >
                      {formatCurrency(customer.currentDebt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {customer.creditLimitEnabled && customer.creditLimit ? (
                      <Box>
                        <Typography variant="body2">
                          {formatCurrency(customer.creditLimit)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((customer.currentDebt / customer.creditLimit) * 100, 100)}
                          color={
                            customer.currentDebt / customer.creditLimit > 0.8 ? 'error' : 'primary'
                          }
                          sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                        />
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Illimitée
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={customer.isActive ? 'Actif' : 'Inactif'}
                      color={customer.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionClick(e, customer);
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
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
        <MenuItem onClick={handleViewCustomer}>
          <Visibility fontSize="small" sx={{ mr: 1 }} />
          Voir détails
        </MenuItem>
        <MenuItem onClick={handleEditCustomer}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Modifier
        </MenuItem>
        <MenuItem onClick={handleEditCredit}>
          <CreditCard fontSize="small" sx={{ mr: 1 }} />
          Modifier limite crédit
        </MenuItem>
      </Menu>

      {/* Dialog Limite Crédit */}
      <Dialog open={creditDialogOpen} onClose={() => setCreditDialogOpen(false)}>
        <DialogTitle>Modifier la limite de crédit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Client: {selectedCustomer?.name}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Dette actuelle: {formatCurrency(selectedCustomer?.currentDebt || 0)}
          </Typography>
          <TextField
            fullWidth
            label="Nouvelle limite de crédit"
            type="number"
            value={newCreditLimit}
            onChange={(e) => setNewCreditLimit(Number(e.target.value))}
            InputProps={{
              endAdornment: <InputAdornment position="end">DA</InputAdornment>,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleCreditUpdate}
            disabled={updateCreditMutation.isPending}
          >
            {updateCreditMutation.isPending ? 'En cours...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomersPage;
