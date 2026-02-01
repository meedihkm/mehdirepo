// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE UTILISATEURS (React Admin)
// Gestion des utilisateurs et des rôles
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
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Search,
  Add,
  MoreVert,
  Edit,
  Lock,
  Delete,
  Refresh,
  Person,
  LocalShipping,
  AdminPanelSettings,
  Kitchen,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useDebounce } from 'use-debounce';

import { api } from '../api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type UserRole = 'admin' | 'manager' | 'deliverer' | 'kitchen' | 'accountant';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const userSchema = z.object({
  email: z.string().email('Email invalide'),
  name: z.string().min(2, 'Nom requis'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'deliverer', 'kitchen', 'accountant']),
  password: z.string().min(6, 'Minimum 6 caractères').optional(),
  isActive: z.boolean(),
});

type UserFormData = z.infer<typeof userSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const ROLE_CONFIG: Record<UserRole, { label: string; color: any; icon: React.ReactNode }> = {
  admin: { label: 'Administrateur', color: 'error', icon: <AdminPanelSettings /> },
  manager: { label: 'Manager', color: 'warning', icon: <Person /> },
  deliverer: { label: 'Livreur', color: 'info', icon: <LocalShipping /> },
  kitchen: { label: 'Cuisine', color: 'success', icon: <Kitchen /> },
  accountant: { label: 'Comptable', color: 'secondary', icon: <Person /> },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // État
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [roleFilter, setRoleFilter] = useState('');
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Form
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
      role: 'deliverer',
      password: '',
      isActive: true,
    },
  });

  // Fetch utilisateurs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', debouncedSearch, page, rowsPerPage, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page + 1));
      params.set('limit', String(rowsPerPage));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);

      const response = await api.get(`/users?${params.toString()}`);
      return response.data;
    },
  });

  // Mutation création/modification
  const saveMutation = useMutation({
    mutationFn: async (formData: UserFormData) => {
      if (isEditing && selectedUser) {
        return api.patch(`/users/${selectedUser.id}`, formData);
      }
      return api.post('/users', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserDialogOpen(false);
      reset();
      enqueueSnackbar(isEditing ? 'Utilisateur modifié' : 'Utilisateur créé', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  // Mutation reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/users/${selectedUser?.id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      setResetPasswordDialogOpen(false);
      setNewPassword('');
      enqueueSnackbar('Mot de passe réinitialisé', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  // Handlers
  const handleActionClick = (event: React.MouseEvent<HTMLElement>, user: User) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
  };

  const handleOpenCreateDialog = () => {
    setIsEditing(false);
    reset({
      email: '',
      name: '',
      phone: '',
      role: 'deliverer',
      password: '',
      isActive: true,
    });
    setUserDialogOpen(true);
  };

  const handleOpenEditDialog = () => {
    if (selectedUser) {
      setIsEditing(true);
      reset({
        email: selectedUser.email,
        name: selectedUser.name,
        phone: selectedUser.phone || '',
        role: selectedUser.role,
        password: '',
        isActive: selectedUser.isActive,
      });
      setUserDialogOpen(true);
    }
    handleActionClose();
  };

  const handleOpenResetPassword = () => {
    setResetPasswordDialogOpen(true);
    handleActionClose();
  };

  const onSubmit = (data: UserFormData) => {
    // Ne pas envoyer le password si vide en mode édition
    const payload = { ...data };
    if (isEditing && !payload.password) {
      delete payload.password;
    }
    saveMutation.mutate(payload);
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Utilisateurs
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenCreateDialog}
        >
          Nouvel utilisateur
        </Button>
      </Box>

      {/* Filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              placeholder="Rechercher par nom, email..."
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
              <InputLabel>Rôle</InputLabel>
              <Select
                value={roleFilter}
                label="Rôle"
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Tous</MenuItem>
                {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                  <MenuItem key={key} value={key}>{config.label}</MenuItem>
                ))}
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

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell align="center">Statut</TableCell>
                <TableCell>Dernière connexion</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.data.map((user: User) => {
                const roleConfig = ROLE_CONFIG[user.role];
                return (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: `${roleConfig.color}.main` }}>
                          {roleConfig.icon}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {user.name}
                          </Typography>
                          {user.phone && (
                            <Typography variant="caption" color="textSecondary">
                              {user.phone}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={roleConfig.label}
                        color={roleConfig.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={user.isActive ? 'Actif' : 'Inactif'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm')
                        : 'Jamais'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionClick(e, user)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={data?.pagination?.total || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Lignes par page"
        />
      </Paper>

      {/* Menu Actions */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionClose}
      >
        <MenuItem onClick={handleOpenEditDialog}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Modifier
        </MenuItem>
        <MenuItem onClick={handleOpenResetPassword}>
          <Lock fontSize="small" sx={{ mr: 1 }} />
          Réinitialiser mot de passe
        </MenuItem>
      </Menu>

      {/* Dialog Création/Modification */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {isEditing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Nom complet"
                      error={!!errors.name}
                      helperText={errors.name?.message}
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
              <Grid item xs={12} sm={6}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Téléphone"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Rôle</InputLabel>
                      <Select {...field} label="Rôle">
                        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                          <MenuItem key={key} value={key}>{config.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isEditing ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
                      type="password"
                      error={!!errors.password}
                      helperText={errors.password?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
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
                      label="Compte actif"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialogOpen(false)}>Annuler</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog Reset Password */}
      <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)}>
        <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Utilisateur: {selectedUser?.name}
          </Typography>
          <TextField
            fullWidth
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => resetPasswordMutation.mutate()}
            disabled={resetPasswordMutation.isPending || newPassword.length < 6}
          >
            Réinitialiser
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;
