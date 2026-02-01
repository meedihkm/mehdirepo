// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAGE 404 (React Admin)
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="grey.100"
      p={3}
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '6rem', md: '10rem' },
          fontWeight: 'bold',
          color: 'primary.main',
          lineHeight: 1,
        }}
      >
        404
      </Typography>
      
      <Typography variant="h5" color="textSecondary" mt={2} mb={4} textAlign="center">
        Oups ! Cette page n'existe pas.
      </Typography>
      
      <Typography variant="body1" color="textSecondary" mb={4} textAlign="center" maxWidth={400}>
        La page que vous recherchez a peut-être été déplacée, supprimée, 
        ou n'a jamais existé.
      </Typography>

      <Box display="flex" gap={2}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
        >
          Retour
        </Button>
        <Button
          variant="contained"
          startIcon={<Home />}
          onClick={() => navigate('/')}
        >
          Accueil
        </Button>
      </Box>
    </Box>
  );
};

export default NotFoundPage;
