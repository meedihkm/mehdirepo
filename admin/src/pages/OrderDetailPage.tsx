// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE DÉTAIL COMMANDE (React Admin)
// Affichage complet d'une commande avec actions
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Print,
  LocalShipping,
  Cancel,
  Check,
  Person,
  Phone,
  LocationOn,
  Receipt,
  Payment,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSnackbar } from 'notistack';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';

interface OrderItem {
  id: string;
  product: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
    address: string;
    currentDebt: number;
  };
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  totalAmount: number;
  paidAmount: number;
  source: string;
  notes?: string;
  requestedDeliveryDate?: string;
  delivery?: {
    id: string;
    status: string;
    deliverer: {
      id: string;
      name: string;
      phone: string;
    };
    completedAt?: string;
    amountCollected?: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    mode: string;
    reference?: string;
    createdAt: string;
  }>;
  statusHistory: Array<{
    status: string;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: any }> = {
  draft: { label: 'Brouillon', color: 'default' },
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirmée', color: 'info' },
  preparing: { label: 'En préparation', color: 'secondary' },
  ready: { label: 'Prête', color: 'primary' },
  delivering: { label: 'En livraison', color: 'info' },
  delivered: { label: 'Livrée', color: 'success' },
  cancelled: { label: 'Annulée', color: 'error' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const OrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('pending');

  // Fetch commande
  const { data: order, isLoading, isError, error } = useQuery<OrderDetail>({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await api.get(`/orders/${id}`);
      return response.data.data;
    },
  });

  // Mutation changement statut
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: OrderStatus }) => {
      return api.patch(`/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setStatusDialogOpen(false);
      enqueueSnackbar('Statut mis à jour', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  // Mutation annulation
  const cancelMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      return api.post(`/orders/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setCancelDialogOpen(false);
      enqueueSnackbar('Commande annulée', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ').format(value) + ' DA';
  };

  const getPaymentModeLabel = (mode: string) => {
    switch (mode) {
      case 'cash': return 'Espèces';
      case 'check': return 'Chèque';
      case 'ccp': return 'CCP';
      case 'bank_transfer': return 'Virement';
      default: return mode;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !order) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {(error as Error)?.message || 'Commande non trouvée'}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/orders')} sx={{ mt: 2 }}>
          Retour aux commandes
        </Button>
      </Box>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status];
  const remainingAmount = order.totalAmount - order.paidAmount;
  const canEdit = ['draft', 'pending'].includes(order.status);
  const canCancel = !['delivered', 'cancelled'].includes(order.status);
  const canChangeStatus = !['delivered', 'cancelled'].includes(order.status);

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/orders')} sx={{ mb: 1 }}>
            Retour
          </Button>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h4" fontWeight="bold">
              {order.orderNumber}
            </Typography>
            <Chip
              label={statusConfig.label}
              color={statusConfig.color}
              size="medium"
            />
          </Box>
          <Typography variant="body2" color="textSecondary">
            Créée le {format(new Date(order.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            {' par '}{order.createdBy.name}
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => navigate(`/orders/${id}/edit`)}
            >
              Modifier
            </Button>
          )}
          <Button variant="outlined" startIcon={<Print />}>
            Imprimer
          </Button>
          {canChangeStatus && (
            <Button
              variant="contained"
              startIcon={<Check />}
              onClick={() => {
                setNewStatus(getNextStatus(order.status));
                setStatusDialogOpen(true);
              }}
            >
              Changer statut
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={() => setCancelDialogOpen(true)}
            >
              Annuler
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Colonne principale */}
        <Grid item xs={12} md={8}>
          {/* Articles */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
                Articles ({order.items.length})
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Produit</TableCell>
                      <TableCell align="center">Qté</TableCell>
                      <TableCell align="right">Prix unit.</TableCell>
                      <TableCell align="right">Remise</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.product.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {item.product.sku}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {item.quantity} {item.product.unit}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell align="right">
                          {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {formatCurrency(item.lineTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              {/* Totaux */}
              <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                <Box display="flex" gap={4}>
                  <Typography color="textSecondary">Sous-total:</Typography>
                  <Typography>{formatCurrency(order.subtotal)}</Typography>
                </Box>
                {order.discount > 0 && (
                  <Box display="flex" gap={4}>
                    <Typography color="textSecondary">Remise:</Typography>
                    <Typography color="error.main">-{formatCurrency(order.discount)}</Typography>
                  </Box>
                )}
                {order.deliveryFee > 0 && (
                  <Box display="flex" gap={4}>
                    <Typography color="textSecondary">Livraison:</Typography>
                    <Typography>{formatCurrency(order.deliveryFee)}</Typography>
                  </Box>
                )}
                <Divider sx={{ width: 200 }} />
                <Box display="flex" gap={4}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(order.totalAmount)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Paiements */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Payment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Paiements
              </Typography>

              {order.payments.length === 0 ? (
                <Typography color="textSecondary">Aucun paiement enregistré</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell>Référence</TableCell>
                        <TableCell align="right">Montant</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {order.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell>{getPaymentModeLabel(payment.mode)}</TableCell>
                          <TableCell>{payment.reference || '-'}</TableCell>
                          <TableCell align="right">
                            <Typography color="success.main" fontWeight="bold">
                              {formatCurrency(payment.amount)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Divider sx={{ my: 2 }} />

              <Box display="flex" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="textSecondary">Payé</Typography>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(order.paidAmount)}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2" color="textSecondary">Reste à payer</Typography>
                  <Typography variant="h6" color={remainingAmount > 0 ? 'error.main' : 'success.main'}>
                    {formatCurrency(remainingAmount)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Historique */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Historique
              </Typography>
              <Timeline position="alternate">
                {order.statusHistory.map((entry, index) => (
                  <TimelineItem key={index}>
                    <TimelineOppositeContent color="textSecondary" sx={{ flex: 0.3 }}>
                      {format(new Date(entry.changedAt), 'dd/MM HH:mm')}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color={STATUS_CONFIG[entry.status as OrderStatus]?.color || 'grey'} />
                      {index < order.statusHistory.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="body2" fontWeight="medium">
                        {STATUS_CONFIG[entry.status as OrderStatus]?.label || entry.status}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {entry.changedBy}
                      </Typography>
                      {entry.reason && (
                        <Typography variant="caption" display="block" color="textSecondary">
                          {entry.reason}
                        </Typography>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </CardContent>
          </Card>
        </Grid>

        {/* Colonne latérale */}
        <Grid item xs={12} md={4}>
          {/* Client */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                Client
              </Typography>
              <Box>
                <Typography variant="body1" fontWeight="bold">
                  {order.customer.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Code: {order.customer.code}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Phone fontSize="small" color="action" />
                <Typography variant="body2">{order.customer.phone}</Typography>
              </Box>
              <Box display="flex" alignItems="flex-start" gap={1}>
                <LocationOn fontSize="small" color="action" />
                <Typography variant="body2">{order.customer.address}</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="body2" color="textSecondary">Dette actuelle</Typography>
                <Typography
                  variant="h6"
                  color={order.customer.currentDebt > 0 ? 'error.main' : 'success.main'}
                >
                  {formatCurrency(order.customer.currentDebt)}
                </Typography>
              </Box>
              <Button
                fullWidth
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => navigate(`/customers/${order.customer.id}`)}
              >
                Voir fiche client
              </Button>
            </CardContent>
          </Card>

          {/* Livraison */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LocalShipping sx={{ mr: 1, verticalAlign: 'middle' }} />
                Livraison
              </Typography>

              {order.requestedDeliveryDate && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">Date demandée</Typography>
                  <Typography>
                    {format(new Date(order.requestedDeliveryDate), 'EEEE dd MMMM yyyy', { locale: fr })}
                  </Typography>
                </Box>
              )}

              {order.delivery ? (
                <>
                  <Box mb={2}>
                    <Typography variant="body2" color="textSecondary">Livreur</Typography>
                    <Typography fontWeight="medium">{order.delivery.deliverer.name}</Typography>
                    <Typography variant="body2">{order.delivery.deliverer.phone}</Typography>
                  </Box>
                  <Chip
                    label={order.delivery.status}
                    color={order.delivery.status === 'completed' ? 'success' : 'info'}
                    size="small"
                  />
                  {order.delivery.completedAt && (
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">Livrée le</Typography>
                      <Typography>
                        {format(new Date(order.delivery.completedAt), 'dd/MM/yyyy à HH:mm')}
                      </Typography>
                    </Box>
                  )}
                  {order.delivery.amountCollected !== undefined && (
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">Encaissé</Typography>
                      <Typography color="success.main" fontWeight="bold">
                        {formatCurrency(order.delivery.amountCollected)}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <Typography color="textSecondary" mb={2}>
                    Livraison non assignée
                  </Typography>
                  {order.status === 'ready' && (
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<LocalShipping />}
                      onClick={() => navigate(`/deliveries/assign?orderId=${order.id}`)}
                    >
                      Assigner un livreur
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Notes</Typography>
                <Typography variant="body2">{order.notes}</Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Dialog changement statut */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
        <DialogTitle>Changer le statut</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Nouveau statut</InputLabel>
            <Select
              value={newStatus}
              label="Nouveau statut"
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
            >
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => updateStatusMutation.mutate({ status: newStatus })}
            disabled={updateStatusMutation.isPending}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog annulation */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Annuler la commande</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Cette action est irréversible. Le stock sera réajusté.
          </Alert>
          <TextField
            fullWidth
            label="Raison de l'annulation"
            multiline
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Retour</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => cancelMutation.mutate({ reason: cancelReason })}
            disabled={cancelMutation.isPending || !cancelReason}
          >
            Confirmer l'annulation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper
function getNextStatus(current: OrderStatus): OrderStatus {
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
}

export default OrderDetailPage;
