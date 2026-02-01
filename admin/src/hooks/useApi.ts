// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - REACT QUERY HOOKS
// Hooks réutilisables pour toutes les entités CRUD
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from '../api/client';

// ─── TYPES GÉNÉRIQUES ────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
}

// ─── HOOK FACTORY ────────────────────────────────────────────────────────────

function createEntityHooks<T>(entityName: string, basePath: string) {
  const keys = {
    all: [entityName] as const,
    lists: () => [...keys.all, 'list'] as const,
    list: (filters: any) => [...keys.lists(), filters] as const,
    details: () => [...keys.all, 'detail'] as const,
    detail: (id: string) => [...keys.details(), id] as const,
  };

  // Liste paginée
  function useList(params?: Record<string, any>, options?: Partial<UseQueryOptions>) {
    return useQuery({
      queryKey: keys.list(params),
      queryFn: async () => {
        const response = await api.get(basePath, { params });
        return response.data as PaginatedResponse<T>;
      },
      ...options,
    });
  }

  // Détail par ID
  function useDetail(id: string | undefined, options?: Partial<UseQueryOptions>) {
    return useQuery({
      queryKey: keys.detail(id!),
      queryFn: async () => {
        const response = await api.get(`${basePath}/${id}`);
        return response.data as SingleResponse<T>;
      },
      enabled: !!id,
      ...options,
    });
  }

  // Créer
  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (data: Partial<T>) => {
        const response = await api.post(basePath, data);
        return response.data as SingleResponse<T>;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: keys.all });
      },
    });
  }

  // Modifier
  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, data }: { id: string; data: Partial<T> }) => {
        const response = await api.put(`${basePath}/${id}`, data);
        return response.data as SingleResponse<T>;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: keys.detail(variables.id) });
        queryClient.invalidateQueries({ queryKey: keys.lists() });
      },
    });
  }

  // Supprimer
  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        await api.delete(`${basePath}/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: keys.all });
      },
    });
  }

  return { keys, useList, useDetail, useCreate, useUpdate, useDelete };
}

// ─── ENTITY HOOKS ────────────────────────────────────────────────────────────

// Commandes
export const ordersHooks = createEntityHooks<any>('orders', '/orders');
export const useOrders = ordersHooks.useList;
export const useOrder = ordersHooks.useDetail;
export const useCreateOrder = ordersHooks.useCreate;
export const useUpdateOrder = ordersHooks.useUpdate;

// Actions spécifiques commandes
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await api.put(`/orders/${id}/status`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ordersHooks.keys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ordersHooks.keys.lists() });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.put(`/orders/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersHooks.keys.all });
    },
  });
}

// Clients
export const customersHooks = createEntityHooks<any>('customers', '/customers');
export const useCustomers = customersHooks.useList;
export const useCustomer = customersHooks.useDetail;
export const useCreateCustomer = customersHooks.useCreate;
export const useUpdateCustomer = customersHooks.useUpdate;
export const useDeleteCustomer = customersHooks.useDelete;

// Statement client
export function useCustomerStatement(customerId: string | undefined, params?: any) {
  return useQuery({
    queryKey: ['customers', 'statement', customerId, params],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}/statement`, { params });
      return response.data;
    },
    enabled: !!customerId,
  });
}

// Produits
export const productsHooks = createEntityHooks<any>('products', '/products');
export const useProducts = productsHooks.useList;
export const useProduct = productsHooks.useDetail;
export const useCreateProduct = productsHooks.useCreate;
export const useUpdateProduct = productsHooks.useUpdate;
export const useDeleteProduct = productsHooks.useDelete;

// Livraisons
export const deliveriesHooks = createEntityHooks<any>('deliveries', '/deliveries');
export const useDeliveries = deliveriesHooks.useList;
export const useDelivery = deliveriesHooks.useDetail;

export function useAssignDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { orderId: string; delivererId: string }) => {
      const response = await api.post('/deliveries/assign', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliveriesHooks.keys.all });
      queryClient.invalidateQueries({ queryKey: ordersHooks.keys.all });
    },
  });
}

// Utilisateurs
export const usersHooks = createEntityHooks<any>('users', '/users');
export const useUsers = usersHooks.useList;
export const useUserDetail = usersHooks.useDetail;
export const useCreateUser = usersHooks.useCreate;
export const useUpdateUser = usersHooks.useUpdate;
export const useDeleteUser = usersHooks.useDelete;

// Paiements
export const paymentsHooks = createEntityHooks<any>('payments', '/payments');
export const usePayments = paymentsHooks.useList;
export const useCreatePayment = paymentsHooks.useCreate;

// Dashboard
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/organization/dashboard');
      return response.data;
    },
    refetchInterval: 30_000, // Refresh toutes les 30s
  });
}

// Reports
export function useReport(type: string, params?: any) {
  return useQuery({
    queryKey: ['reports', type, params],
    queryFn: async () => {
      const response = await api.get(`/reports/${type}`, { params });
      return response.data;
    },
    enabled: !!type,
  });
}

// Catégories
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

// Export Excel
export function useExportExcel() {
  return useMutation({
    mutationFn: async ({ type, params }: { type: string; params?: any }) => {
      const response = await api.get(`/reports/${type}/export`, {
        params,
        responseType: 'blob',
      });

      // Télécharger le fichier
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });
}
