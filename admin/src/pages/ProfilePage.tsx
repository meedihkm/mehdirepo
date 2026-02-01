// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE PROFIL UTILISATEUR (React Admin)
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
  Avatar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save, Lock, Person } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { api } from '../api/client';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  createdAt: string;
}

const ProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch profil
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/auth/profile');
      const data = response.data.data;
      setName(data.name);
      setPhone(data.phone || '');
      return data;
    },
  });

  // Mutation mise à jour profil
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return api.patch('/auth/profile', { name, phone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      enqueueSnackbar('Profil mis à jour', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  // Mutation changement mot de passe
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      return api.post('/auth/change-password', { currentPassword, newPassword });
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      enqueueSnackbar('Mot de passe modifié', { variant: 'success' });
    },
    onError: (err: any) => {
      enqueueSnackbar(err.message || 'Erreur', { variant: 'error' });
    },
  });

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      enqueueSnackbar('Les mots de passe ne correspondent pas', { variant: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      enqueueSnackbar('Le mot de passe doit contenir au moins 6 caractères', { variant: 'error' });
      return;
    }
    changePasswordMutation.mutate();
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Mon profil
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {/* Informations personnelles */}
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                  <Person fontSize="large" />
                </Avatar>
                <Box>
                  <Typography variant="h6">{profile?.name}</Typography>
                  <Typography color="textSecondary">{profile?.email}</Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nom complet"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={profile?.email}
                    disabled
                    helperText="L'email ne peut pas être modifié"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={updateProfileMutation.isPending ? <CircularProgress size={20} /> : <Save />}
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={updateProfileMutation.isPending}
                  >
                    Enregistrer
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          {/* Changement mot de passe */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Lock sx={{ mr: 1, verticalAlign: 'middle' }} />
                Changer le mot de passe
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Mot de passe actuel"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nouveau mot de passe"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Confirmer le nouveau mot de passe"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={confirmPassword !== '' && newPassword !== confirmPassword}
                    helperText={confirmPassword !== '' && newPassword !== confirmPassword ? 'Les mots de passe ne correspondent pas' : ''}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}
                  >
                    {changePasswordMutation.isPending ? 'En cours...' : 'Changer le mot de passe'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
