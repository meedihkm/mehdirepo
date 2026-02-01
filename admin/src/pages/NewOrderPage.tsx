// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE CRÉATION COMMANDE (React Admin)
// Formulaire de création/modification de commande
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Divider,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Add,
  Delete,
  Search,
  ShoppingCart,
  Person,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
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
  address: string;
  currentDebt: number;
  creditLimit?: number;
  creditLimitEnabled: boolean;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentPrice: number;
  stockQuantity: number;
  category: { name: string };
}

interface OrderLineItem {
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const NewOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(id);
  const preselectedCustomerId = searchParams.get('customerId');

  // État
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch] = useDebounce(customerSearch, 300);
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch] = useDebounce(productSearch, 300);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lineDiscount, setLineDiscount] = useState(0);

  // Fetch clients
  const { data: customers, isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers', 'search', debouncedCustomerSearch],
    queryFn: async () => {
      const response = await api.get('/customers', {
        params: { search: debouncedCustomerSearch, limit: 20 },
      });
      return response.data.data;
    },
    enabled: debouncedCustomerSearch.length > 0 || !selectedCustomer,
  });

  // Fetch produits
  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products', 'search', debouncedProductSearch],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: { search: debouncedProductSearch, limit: 50, isActive: true },
      });
      return response.data.data;
    },
  });

  // Calculs
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice - item.discount);
    }, 0);
  }, [items]);

  const total = useMemo(() => {
    return subtotal - orderDiscount + deliveryFee;
  }, [subtotal, orderDiscount, deliveryFee]);

  // Vérification crédit
  const creditCheck = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.creditLimitEnabled || !selectedCustomer.creditLimit) {
      return { valid: true, available: Infinity };
    }
    const available = selectedCustomer.creditLimit - selectedCustomer.currentDebt;
    return {
      valid: total <= available,
      available,
    };
  }, [selectedCustomer, total]);

  // Mutation création
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return api.patch(`/orders/${id}`, data);
      }
      return api.post('/orders', data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      enqueueSnackbar(isEditing ? 'Commande modifiée' : 'Commande créée', { variant: 'success' });
      navigate(`/orders/${response.data.data.id}`);
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  // Handlers
  const handleAddProduct = () => {
    if (!selectedProduct) return;

    const existingIndex = items.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingIndex >= 0) {
      // Mettre à jour la quantité
      const newItems = [...items];
      newItems[existingIndex].quantity += quantity;
      newItems[existingIndex].discount += lineDiscount;
      setItems(newItems);
    } else {
      // Ajouter nouvelle ligne
      setItems([
        ...items,
        {
          productId: selectedProduct.id,
          product: selectedProduct,
          quantity,
          unitPrice: selectedProduct.currentPrice,
          discount: lineDiscount,
        },
      ]);
    }

    setProductDialogOpen(false);
    setSelectedProduct(null);
    setQuantity(1);
    setLineDiscount(0);
  };

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(index);
      return;
    }
    const newItems = [...items];
    newItems[index].quantity = newQuantity;
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedCustomer) {
      enqueueSnackbar('Veuillez sélectionner un client', { variant: 'warning' });
      return;
    }
    if (items.length === 0) {
      enqueueSnackbar('Veuillez ajouter au moins un produit', { variant: 'warning' });
      return;
    }

    const orderData = {
      customerId: selectedCustomer.id,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      discount: orderDiscount,
      deliveryFee,
      requestedDeliveryDate: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : undefined,
      notes: notes || undefined,
    };

    createOrderMutation.mutate(orderData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box p={3}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/orders')}>
            Retour
          </Button>
          <Typography variant="h5" fontWeight="bold">
            {isEditing ? 'Modifier la commande' : 'Nouvelle commande'}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Colonne principale */}
          <Grid item xs={12} md={8}>
            {/* Sélection client */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Client
                </Typography>

                {selectedCustomer ? (
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body1" fontWeight="bold">
                          {selectedCustomer.name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {selectedCustomer.code} • {selectedCustomer.phone}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {selectedCustomer.address}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setSelectedCustomer(null)}
                      >
                        Changer
                      </Button>
                    </Box>
                    {selectedCustomer.creditLimitEnabled && (
                      <Alert
                        severity={creditCheck.valid ? 'info' : 'warning'}
                        sx={{ mt: 2 }}
                      >
                        Crédit disponible: {formatCurrency(creditCheck.available)}
                        {selectedCustomer.currentDebt > 0 && (
                          <> • Dette actuelle: {formatCurrency(selectedCustomer.currentDebt)}</>
                        )}
                      </Alert>
                    )}
                  </Box>
                ) : (
                  <Autocomplete
                    options={customers || []}
                    getOptionLabel={(option) => `${option.code} - ${option.name}`}
                    loading={loadingCustomers}
                    onInputChange={(_, value) => setCustomerSearch(value)}
                    onChange={(_, value) => setSelectedCustomer(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Rechercher un client..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <Search color="action" sx={{ mr: 1 }} />
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {option.code} - {option.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {option.phone} • {option.address}
                          </Typography>
                        </Box>
                      </li>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Produits */}
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    <ShoppingCart sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Produits ({items.length})
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setProductDialogOpen(true)}
                  >
                    Ajouter produit
                  </Button>
                </Box>

                {items.length === 0 ? (
                  <Alert severity="info">
                    Cliquez sur "Ajouter produit" pour commencer
                  </Alert>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Produit</TableCell>
                          <TableCell align="center">Qté</TableCell>
                          <TableCell align="right">Prix unit.</TableCell>
                          <TableCell align="right">Remise</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item, index) => {
                          const lineTotal = item.quantity * item.unitPrice - item.discount;
                          return (
                            <TableRow key={item.productId}>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {item.product.name}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {item.product.sku} • Stock: {item.product.stockQuantity}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <TextField
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateQuantity(index, Number(e.target.value))}
                                  size="small"
                                  sx={{ width: 80 }}
                                  inputProps={{ min: 1 }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(item.unitPrice)}
                              </TableCell>
                              <TableCell align="right">
                                {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '-'}
                              </TableCell>
                              <TableCell align="right">
                                <Typography fontWeight="bold">
                                  {formatCurrency(lineTotal)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Delete />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Colonne latérale */}
          <Grid item xs={12} md={4}>
            {/* Totaux */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Récapitulatif</Typography>
                
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="textSecondary">Sous-total:</Typography>
                  <Typography>{formatCurrency(subtotal)}</Typography>
                </Box>

                <TextField
                  fullWidth
                  label="Remise globale"
                  type="number"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(Number(e.target.value))}
                  size="small"
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                  }}
                />

                <TextField
                  fullWidth
                  label="Frais de livraison"
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                  size="small"
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                  }}
                />

                <Divider sx={{ my: 2 }} />

                <Box display="flex" justifyContent="space-between">
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">
                    {formatCurrency(total)}
                  </Typography>
                </Box>

                {!creditCheck.valid && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Le total dépasse le crédit disponible
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Options</Typography>

                <DatePicker
                  label="Date de livraison souhaitée"
                  value={deliveryDate}
                  onChange={setDeliveryDate}
                  slotProps={{ textField: { fullWidth: true, size: 'small', sx: { mb: 2 } } }}
                  minDate={new Date()}
                />

                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instructions spéciales..."
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={createOrderMutation.isPending ? <CircularProgress size={20} /> : <Save />}
                  onClick={handleSubmit}
                  disabled={
                    createOrderMutation.isPending ||
                    !selectedCustomer ||
                    items.length === 0 ||
                    !creditCheck.valid
                  }
                >
                  {createOrderMutation.isPending
                    ? 'Enregistrement...'
                    : isEditing
                    ? 'Enregistrer'
                    : 'Créer la commande'}
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/orders')}
                >
                  Annuler
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Dialog ajout produit */}
        <Dialog
          open={productDialogOpen}
          onClose={() => setProductDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Ajouter un produit</DialogTitle>
          <DialogContent>
            <Autocomplete
              options={products || []}
              getOptionLabel={(option) => `${option.sku} - ${option.name}`}
              loading={loadingProducts}
              onInputChange={(_, value) => setProductSearch(value)}
              onChange={(_, value) => setSelectedProduct(value)}
              sx={{ mt: 2, mb: 2 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Rechercher un produit..."
                  autoFocus
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box sx={{ width: '100%' }}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" fontWeight="medium">
                        {option.name}
                      </Typography>
                      <Typography variant="body2" color="primary.main" fontWeight="bold">
                        {formatCurrency(option.currentPrice)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="textSecondary">
                        {option.sku} • {option.category.name}
                      </Typography>
                      <Chip
                        label={`Stock: ${option.stockQuantity}`}
                        size="small"
                        color={option.stockQuantity > 10 ? 'success' : 'warning'}
                      />
                    </Box>
                  </Box>
                </li>
              )}
            />

            {selectedProduct && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Quantité"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    inputProps={{ min: 1 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {selectedProduct.unit}
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Remise ligne"
                    type="number"
                    value={lineDiscount}
                    onChange={(e) => setLineDiscount(Number(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Alert severity="info">
                    Total ligne: {formatCurrency(quantity * selectedProduct.currentPrice - lineDiscount)}
                  </Alert>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProductDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleAddProduct}
              disabled={!selectedProduct || quantity <= 0}
            >
              Ajouter
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default NewOrderPage;
