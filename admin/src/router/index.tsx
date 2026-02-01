// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONFIGURATION ROUTEUR (React Admin)
// Routes et navigation de l'application admin
// ═══════════════════════════════════════════════════════════════════════════════

import React, { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

import { tokenStorage } from '../api/client';
import Layout from '../components/Layout';

// ═══════════════════════════════════════════════════════════════════════════════
// LAZY LOADING DES PAGES
// ═══════════════════════════════════════════════════════════════════════════════

const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('../pages/OrderDetailPage'));
const NewOrderPage = lazy(() => import('../pages/NewOrderPage'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const CustomerDetailPage = lazy(() => import('../pages/CustomerDetailPage'));
const NewCustomerPage = lazy(() => import('../pages/NewCustomerPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const NewProductPage = lazy(() => import('../pages/NewProductPage'));
const DeliveriesPage = lazy(() => import('../pages/DeliveriesPage'));
const FinancePage = lazy(() => import('../pages/FinancePage'));
const DeliverersPage = lazy(() => import('../pages/DeliverersPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const NotificationsPage = lazy(() => import('../components/Notifications').then(m => ({ default: m.NotificationsPage })));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

// Loading spinner
const LoadingFallback = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
  >
    <CircularProgress />
  </Box>
);

// Route protégée
const ProtectedRoute: React.FC = () => {
  const isAuthenticated = tokenStorage.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

// Route publique (redirige si connecté)
const PublicRoute: React.FC = () => {
  const isAuthenticated = tokenStorage.isAuthenticated();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Outlet />
    </Suspense>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION DES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

const router = createBrowserRouter([
  // Routes publiques
  {
    element: <PublicRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },

  // Routes protégées
  {
    element: <ProtectedRoute />,
    children: [
      // Dashboard
      {
        path: '/',
        element: <DashboardPage />,
      },

      // Commandes
      {
        path: '/orders',
        element: <OrdersPage />,
      },
      {
        path: '/orders/new',
        element: <NewOrderPage />,
      },
      {
        path: '/orders/:id',
        element: <OrderDetailPage />,
      },
      {
        path: '/orders/:id/edit',
        element: <NewOrderPage />,
      },

      // Clients
      {
        path: '/customers',
        element: <CustomersPage />,
      },
      {
        path: '/customers/new',
        element: <NewCustomerPage />,
      },
      {
        path: '/customers/:id',
        element: <CustomerDetailPage />,
      },
      {
        path: '/customers/:id/edit',
        element: <NewCustomerPage />,
      },

      // Produits
      {
        path: '/products',
        element: <ProductsPage />,
      },
      {
        path: '/products/new',
        element: <NewProductPage />,
      },
      {
        path: '/products/:id',
        element: <ProductDetailPage />,
      },
      {
        path: '/products/:id/edit',
        element: <NewProductPage />,
      },

      // Livraisons
      {
        path: '/deliveries',
        element: <DeliveriesPage />,
      },
      {
        path: '/deliveries/assign',
        element: <DeliveriesPage />,
      },

      // Finance
      {
        path: '/finance',
        element: <FinancePage />,
      },

      // Livreurs
      {
        path: '/deliverers',
        element: <DeliverersPage />,
      },

      // Rapports
      {
        path: '/reports',
        element: <ReportsPage />,
      },

      // Utilisateurs
      {
        path: '/users',
        element: <UsersPage />,
      },

      // Paramètres
      {
        path: '/settings',
        element: <SettingsPage />,
      },

      // Profil
      {
        path: '/profile',
        element: <ProfilePage />,
      },

      // Notifications
      {
        path: '/notifications',
        element: <NotificationsPage />,
      },
    ],
  },

  // 404
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;
