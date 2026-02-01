// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - FORMULAIRE CLIENT (React Admin)
// Création et modification de client
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  InputAdornment,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const customerSchema = z.object({
  code: z.string().min(1, 'Code requis').max(20, 'Code trop long'),
  name: z.string().min(2, 'Nom requis (min 2 caractères)').max(100),
  phone: z.string().regex(/^(0|\+213)[5-7][0-9]{8}$/, 'Numéro de téléphone invalide'),
  phone2: z.string().regex(/^(0|\+213)[5-7][0-9]{8}$/, 'Numéro invalide').optional().or(z.literal('')),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.string().min(5, 'Adresse requise'),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  gpsLatitude: z.number().optional(),
  gpsLongitude: z.number().optional(),
  category: z.enum(['normal', 'vip', 'wholesale']),
  creditLimitEnabled: z.boolean(),
  creditLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// WILAYAS ALGÉRIENNES
// ═══════════════════════════════════════════════════════════════════════════════

const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj',
  'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
  'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal',
  'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT
// ═══════════════════════════════════════════════════════════════════════════════

const NewCustomerPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(id);

  // Form
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      code: '',
      name: '',
      phone: '',
      phone2: '',
      email: '',
      address: '',
      city: '',
      wilaya: '',
      category: 'normal',
      creditLimitEnabled: false,
      creditLimit: 0,
      notes: '',
      isActive: true,
    },
  });

  const creditLimitEnabled = watch('creditLimitEnabled');

  // Fetch client existant
  const { data: existingCustomer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}`);
      return response.data.data;
    },
    enabled: isEditing,
  });

  // Remplir le formulaire avec les données existantes
  useEffect(() => {
    if (existingCustomer) {
      reset({
        code: existingCustomer.code,
        name: existingCustomer.name,
        phone: existingCustomer.phone,
        phone2: existingCustomer.phone2 || '',
        email: existingCustomer.email || '',
        address: existingCustomer.address,
        city: existingCustomer.city || '',
        wilaya: existingCustomer.wilaya || '',
        category: existingCustomer.category,
        creditLimitEnabled: existingCustomer.creditLimitEnabled,
        creditLimit: existingCustomer.creditLimit || 0,
        notes: existingCustomer.notes || '',
        isActive: existingCustomer.isActive,
      });
    }
  }, [existingCustomer, reset]);

  // Mutation création/modification
  const saveMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (isEditing) {
        return api.patch(`/customers/${id}`, data);
      }
      return api.post('/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      enqueueSnackbar(
        isEditing ? 'Client modifié avec succès' : 'Client créé avec succès',
        { variant: 'success' }
      );
      navigate('/customers');
    },
    onError: (error: any) => {
      enqueueSnackbar(error.message || 'Erreur lors de l\'enregistrement', {
        variant: 'error',
      });
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    // Nettoyer les champs optionnels vides
    const cleanedData = {
      ...data,
      phone2: data.phone2 || undefined,
      email: data.email || undefined,
      city: data.city || undefined,
      wilaya: data.wilaya || undefined,
      notes: data.notes || undefined,
      creditLimit: data.creditLimitEnabled ? data.creditLimit : undefined,
    };
    saveMutation.mutate(cleanedData);
  };

  if (isEditing && loadingCustomer) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/customers')}>
          Retour
        </Button>
        <Typography variant="h5" fontWeight="bold">
          {isEditing ? 'Modifier le client' : 'Nouveau client'}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Informations générales */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informations générales
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Controller
                      name="code"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Code client *"
                          error={!!errors.code}
                          helperText={errors.code?.message}
                          disabled={isEditing}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={8}>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Nom / Raison sociale *"
                          error={!!errors.name}
                          helperText={errors.name?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Téléphone principal *"
                          placeholder="0555123456"
                          error={!!errors.phone}
                          helperText={errors.phone?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="phone2"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Téléphone secondaire"
                          placeholder="0555123456"
                          error={!!errors.phone2}
                          helperText={errors.phone2?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Email"
                          type="email"
                          error={!!errors.email}
                          helperText={errors.email?.message}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Adresse */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Adresse de livraison
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller
                      name="address"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Adresse complète *"
                          multiline
                          rows={2}
                          error={!!errors.address}
                          helperText={errors.address?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="city"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Ville / Commune"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="wilaya"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Wilaya</InputLabel>
                          <Select {...field} label="Wilaya">
                            <MenuItem value="">-- Sélectionner --</MenuItem>
                            {WILAYAS.map((w) => (
                              <MenuItem key={w} value={w}>
                                {w}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Notes
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes internes"
                      multiline
                      rows={3}
                      placeholder="Informations complémentaires sur le client..."
                    />
                  )}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Paramètres */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Paramètres
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Catégorie</InputLabel>
                      <Select {...field} label="Catégorie">
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="vip">VIP</MenuItem>
                        <MenuItem value="wholesale">Grossiste</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />

                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      }
                      label="Client actif"
                    />
                  )}
                />
              </CardContent>
            </Card>

            {/* Limite de crédit */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Limite de crédit
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Controller
                  name="creditLimitEnabled"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      }
                      label="Activer la limite de crédit"
                    />
                  )}
                />

                {creditLimitEnabled && (
                  <Controller
                    name="creditLimit"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Montant limite"
                        type="number"
                        sx={{ mt: 2 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">DA</InputAdornment>,
                        }}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    )}
                  />
                )}

                {!creditLimitEnabled && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Sans limite, le client peut commander sans restriction de crédit.
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  type="submit"
                  disabled={isSubmitting || saveMutation.isPending}
                  startIcon={
                    saveMutation.isPending ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Save />
                    )
                  }
                >
                  {saveMutation.isPending
                    ? 'Enregistrement...'
                    : isEditing
                    ? 'Enregistrer les modifications'
                    : 'Créer le client'}
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/customers')}
                >
                  Annuler
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default NewCustomerPage;
