// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE LIVREURS
// Gestion des livreurs, suivi temps réel, performance, caisse
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  LocationOn,
  TrendingUp,
  LocalShipping,
  AccountBalanceWallet,
  Phone,
  Email,
  TwoWheeler,
  DirectionsCar,
  DirectionsBike,
  DirectionsWalk,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api/client';
import { User, DailyCash, Delivery, UserRole } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHÉMAS DE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const delivererSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().min(10, 'Téléphone requis'),
  vehicleType: z.enum(['car', 'motorcycle', 'bicycle', 'foot']),
  licensePlate: z.string().optional(),
});

type DelivererFormData = z.infer<typeof delivererSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function DeliverersPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDeliverer, setSelectedDeliverer] = useState<User | null>(null);
  // api client déjà importé
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  const { data: deliverers, isLoading } = useQuery({
    queryKey: ['deliverers'],
    queryFn: () => api.get('/users', { params: { role: 'deliverer' } }),
  });

  const { data: todayCash } = useQuery({
    queryKey: ['deliverers-cash'],
    queryFn: () => api.get('/daily-cash'),
  });

  const { data: activeDeliveries } = useQuery({
    queryKey: ['deliverers-active-deliveries'],
    queryFn: () => api.get('/deliveries', { params: { status: 'assigned,in_transit' } }),
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const createMutation = useMutation({
    mutationFn: (data: DelivererFormData) => 
      api.post('/users', { ...data, role: 'deliverer' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverers'] });
      setIsCreateDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverers'] });
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'car': return <DirectionsCar />;
      case 'motorcycle': return <TwoWheeler />;
      case 'bicycle': return <DirectionsBike />;
      case 'foot': return <DirectionsWalk />;
      default: return <LocalShipping />;
    }
  };

  const getDelivererCash = (delivererId: string) => {
    return todayCash?.data?.data?.find((c: DailyCash) => c.delivererId === delivererId);
  };

  const getDelivererDeliveries = (delivererId: string) => {
    return activeDeliveries?.data?.data?.filter((d: Delivery) => d.delivererId === delivererId) || [];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          🚚 Livreurs
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Nouveau livreur
        </Button>
      </Box>

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Liste des livreurs" />
          <Tab label="Performance" />
          <Tab label="Caisses journalières" />
          <Tab label="Suivi temps réel" />
        </Tabs>
      </Paper>

      {/* Contenu */}
      <Paper sx={{ minHeight: 400 }}>
        {isLoading ? (
          <LinearProgress />
        ) : (
          <>
            {/* Liste */}
            {activeTab === 0 && (
              <DeliverersListTab
                deliverers={deliverers?.data?.data || []}
                onEdit={(d) => setSelectedDeliverer(d)}
                onDelete={(id) => deleteMutation.mutate(id)}
                getVehicleIcon={getVehicleIcon}
                getDelivererDeliveries={getDelivererDeliveries}
              />
            )}

            {/* Performance */}
            {activeTab === 1 && (
              <PerformanceTab deliverers={deliverers?.data?.data || []} />
            )}

            {/* Caisses */}
            {activeTab === 2 && (
              <CashTab 
                deliverers={deliverers?.data?.data || []}
                todayCash={todayCash?.data?.data || []}
              />
            )}

            {/* Suivi temps réel */}
            {activeTab === 3 && (
              <TrackingTab deliverers={deliverers?.data?.data || []} />
            )}
          </>
        )}
      </Paper>

      {/* Dialog création */}
      <CreateDelivererDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

function DeliverersListTab({ 
  deliverers, 
  onEdit, 
  onDelete,
  getVehicleIcon,
  getDelivererDeliveries,
}: {
  deliverers: User[];
  onEdit: (d: User) => void;
  onDelete: (id: string) => void;
  getVehicleIcon: (type: string) => React.ReactNode;
  getDelivererDeliveries: (id: string) => Delivery[];
}) {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Livreur</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Véhicule</TableCell>
            <TableCell>Livraisons actives</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deliverers.map((deliverer) => {
            const activeDeliveries = getDelivererDeliveries(deliverer.id);
            
            return (
              <TableRow key={deliverer.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={deliverer.avatarUrl}>
                      {deliverer.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography fontWeight="medium">{deliverer.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Dernière connexion: {deliverer.lastLoginAt 
                          ? formatDate(deliverer.lastLoginAt) 
                          : 'Jamais'}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    <Phone fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {deliverer.phone}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Email fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {deliverer.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getVehicleIcon(deliverer.vehicleType || 'motorcycle')}
                    <Typography variant="body2">
                      {deliverer.licensePlate || '-'}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    size="small" 
                    color={activeDeliveries.length > 0 ? 'primary' : 'default'}
                    label={`${activeDeliveries.length} en cours`}
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    size="small" 
                    color={deliverer.isActive ? 'success' : 'error'}
                    label={deliverer.isActive ? 'Actif' : 'Inactif'}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Modifier">
                    <IconButton onClick={() => onEdit(deliverer)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Supprimer">
                    <IconButton onClick={() => onDelete(deliverer.id)} color="error">
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PerformanceTab({ deliverers }: { deliverers: User[] }) {
  return (
    <Grid container spacing={3} sx={{ p: 2 }}>
      {deliverers.map((deliverer) => (
        <Grid item xs={12} md={6} lg={4} key={deliverer.id}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar src={deliverer.avatarUrl} sx={{ width: 56, height: 56 }}>
                  {deliverer.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6">{deliverer.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {deliverer.vehicleType}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="h6" color="primary.main">0</Typography>
                  <Typography variant="caption">Livraisons aujourd'hui</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="h6" color="success.main">{formatCurrency(0)}</Typography>
                  <Typography variant="caption">Encaissé</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="h6" color="info.main">0 min</Typography>
                  <Typography variant="caption">Temps moyen</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="h6" color="warning.main">100%</Typography>
                  <Typography variant="caption">Taux réussite</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

function CashTab({ 
  deliverers, 
  todayCash 
}: { 
  deliverers: User[];
  todayCash: DailyCash[];
}) {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Livreur</TableCell>
            <TableCell align="right">Attendu</TableCell>
            <TableCell align="right">Encaissé</TableCell>
            <TableCell align="right">Nouvelles dettes</TableCell>
            <TableCell align="right">Livraisons</TableCell>
            <TableCell>Statut</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deliverers.map((deliverer) => {
            const cash = todayCash.find(c => c.delivererId === deliverer.id);
            
            return (
              <TableRow key={deliverer.id}>
                <TableCell>
                  <Typography fontWeight="medium">{deliverer.name}</Typography>
                </TableCell>
                <TableCell align="right">
                  {cash ? formatCurrency(cash.expectedCollection) : '-'}
                </TableCell>
                <TableCell align="right">
                  <Typography color={cash && cash.actualCollection >= cash.expectedCollection ? 'success.main' : 'inherit'}>
                    {cash ? formatCurrency(cash.actualCollection) : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {cash ? formatCurrency(cash.newDebtCreated) : '-'}
                </TableCell>
                <TableCell align="right">
                  {cash ? `${cash.deliveriesCompleted}/${cash.deliveriesCount}` : '-'}
                </TableCell>
                <TableCell>
                  {cash?.isClosed ? (
                    <Chip size="small" color="success" label="Clôturé" />
                  ) : (
                    <Chip size="small" color="warning" label="En cours" />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TrackingTab({ deliverers }: { deliverers: User[] }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <LocationOn sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Suivi GPS en temps réel
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Cette fonctionnalité nécessite la connexion WebSocket pour le tracking temps réel.
        Les livreurs actuellement actifs apparaîtront sur la carte.
      </Typography>
      
      <Grid container spacing={2}>
        {deliverers.filter(d => d.isActive).map((deliverer) => (
          <Grid item xs={12} md={6} key={deliverer.id}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={deliverer.avatarUrl}>
                    {deliverer.name.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight="medium">{deliverer.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {deliverer.lastPosition ? (
                        <>Position: {deliverer.lastPosition.lat.toFixed(4)}, {deliverer.lastPosition.lng.toFixed(4)}</>
                      ) : (
                        'Position inconnue'
                      )}
                    </Typography>
                  </Box>
                  <Chip 
                    size="small" 
                    color={deliverer.lastPosition ? 'success' : 'default'}
                    label={deliverer.lastPosition ? 'En ligne' : 'Hors ligne'}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG CRÉATION
// ═══════════════════════════════════════════════════════════════════════════════

function CreateDelivererDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DelivererFormData) => void;
  isSubmitting: boolean;
}) {
  const { control, handleSubmit, formState: { errors } } = useForm<DelivererFormData>({
    resolver: zodResolver(delivererSchema),
    defaultValues: {
      vehicleType: 'motorcycle',
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nouveau livreur</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nom complet"
                fullWidth
                margin="normal"
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Email"
                type="email"
                fullWidth
                margin="normal"
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            )}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Téléphone"
                fullWidth
                margin="normal"
                error={!!errors.phone}
                helperText={errors.phone?.message}
              />
            )}
          />
          <Controller
            name="vehicleType"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Type de véhicule"
                fullWidth
                margin="normal"
              >
                <MenuItem value="car">Voiture</MenuItem>
                <MenuItem value="motorcycle">Moto</MenuItem>
                <MenuItem value="bicycle">Vélo</MenuItem>
                <MenuItem value="foot">À pied</MenuItem>
              </TextField>
            )}
          />
          <Controller
            name="licensePlate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Immatriculation (optionnel)"
                fullWidth
                margin="normal"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Création...' : 'Créer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
