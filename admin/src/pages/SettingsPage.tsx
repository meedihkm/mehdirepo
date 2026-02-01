// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE PARAMÈTRES (React Admin)
// Configuration de l'organisation
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Save,
  Business,
  Notifications,
  Security,
  Receipt,
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface OrganizationSettings {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  currency: string;
  timezone: string;
  receiptFooter?: string;
  defaultCreditLimit?: number;
  lowStockThreshold?: number;
  notifications: {
    newOrder: boolean;
    lowStock: boolean;
    deliveryComplete: boolean;
    paymentReceived: boolean;
  };
}

interface Category {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  productCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [currentTab, setCurrentTab] = useState(0);

  // Organisation settings state
  const [settings, setSettings] = useState<OrganizationSettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    currency: 'DZD',
    timezone: 'Africa/Algiers',
    receiptFooter: '',
    defaultCreditLimit: 100000,
    lowStockThreshold: 10,
    notifications: {
      newOrder: true,
      lowStock: true,
      deliveryComplete: true,
      paymentReceived: true,
    },
  });

  // Catégories
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  // Fetch settings
  const { isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      setSettings(response.data.data);
      return response.data.data;
    },
  });

  // Fetch catégories
  const { data: categories, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data.data;
    },
    enabled: currentTab === 2,
  });

  // Mutation save settings
  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.patch('/settings', settings);
    },
    onSuccess: () => {
      enqueueSnackbar('Paramètres enregistrés', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  // Mutation catégories
  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const data = { name: categoryName, description: categoryDescription };
      if (editingCategory) {
        return api.patch(`/categories/${editingCategory.id}`, data);
      }
      return api.post('/categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryDialogOpen(false);
      setCategoryName('');
      setCategoryDescription('');
      setEditingCategory(null);
      enqueueSnackbar('Catégorie enregistrée', { variant: 'success' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      enqueueSnackbar('Catégorie supprimée', { variant: 'success' });
    },
  });

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryDescription(category.description || '');
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryDescription('');
    }
    setCategoryDialogOpen(true);
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Paramètres
      </Typography>

      {/* Onglets */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab icon={<Business />} label="Organisation" iconPosition="start" />
          <Tab icon={<Notifications />} label="Notifications" iconPosition="start" />
          <Tab icon={<Receipt />} label="Catégories" iconPosition="start" />
          <Tab icon={<Security />} label="Sécurité" iconPosition="start" />
        </Tabs>
      </Card>

      {/* Onglet Organisation */}
      {currentTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Informations de l'organisation
            </Typography>
            <Divider sx={{ mb: 3 }} />

            {loadingSettings ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Nom de l'entreprise"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="NIF / Registre de commerce"
                    value={settings.taxId}
                    onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Adresse"
                    multiline
                    rows={2}
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Paramètres par défaut
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Limite de crédit par défaut (DA)"
                    type="number"
                    value={settings.defaultCreditLimit}
                    onChange={(e) => setSettings({ ...settings, defaultCreditLimit: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Seuil d'alerte stock bas"
                    type="number"
                    value={settings.lowStockThreshold}
                    onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Pied de page des reçus"
                    multiline
                    rows={2}
                    value={settings.receiptFooter}
                    onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                    placeholder="Merci de votre confiance!"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={saveMutation.isPending ? <CircularProgress size={20} /> : <Save />}
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    Enregistrer
                  </Button>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglet Notifications */}
      {currentTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Préférences de notifications
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <List>
              <ListItem>
                <ListItemText
                  primary="Nouvelles commandes"
                  secondary="Recevoir une notification pour chaque nouvelle commande"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifications.newOrder}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, newOrder: e.target.checked }
                    })}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Stock bas"
                  secondary="Alerte quand un produit atteint le seuil minimal"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifications.lowStock}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, lowStock: e.target.checked }
                    })}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Livraisons terminées"
                  secondary="Notification quand une livraison est complétée"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifications.deliveryComplete}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, deliveryComplete: e.target.checked }
                    })}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Paiements reçus"
                  secondary="Notification pour chaque paiement encaissé"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notifications.paymentReceived}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, paymentReceived: e.target.checked }
                    })}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                Enregistrer
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Onglet Catégories */}
      {currentTab === 2 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Catégories de produits</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenCategoryDialog()}
              >
                Nouvelle catégorie
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {loadingCategories ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {categories?.map((category) => (
                  <ListItem key={category.id} divider>
                    <ListItemText
                      primary={category.name}
                      secondary={`${category.productCount} produit(s) • ${category.description || 'Pas de description'}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton onClick={() => handleOpenCategoryDialog(category)}>
                        <Edit />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => {
                          if (window.confirm('Supprimer cette catégorie ?')) {
                            deleteCategoryMutation.mutate(category.id);
                          }
                        }}
                        disabled={category.productCount > 0}
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglet Sécurité */}
      {currentTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Paramètres de sécurité
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Alert severity="info" sx={{ mb: 3 }}>
              Les paramètres de sécurité avancés seront disponibles dans une prochaine version.
            </Alert>

            <List>
              <ListItem>
                <ListItemText
                  primary="Expiration de session"
                  secondary="Les sessions expirent après 24 heures d'inactivité"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Authentification à deux facteurs"
                  secondary="Bientôt disponible"
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      )}

      {/* Dialog Catégorie */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)}>
        <DialogTitle>
          {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={2}
            value={categoryDescription}
            onChange={(e) => setCategoryDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => saveCategoryMutation.mutate()}
            disabled={saveCategoryMutation.isPending || !categoryName}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsPage;
