// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CLIENT API (React Admin)
// Configuration Axios avec intercepteurs et gestion d'erreurs
// ═══════════════════════════════════════════════════════════════════════════════

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'awid_token';
const REFRESH_TOKEN_KEY = 'awid_refresh_token';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCKAGE TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens: (tokens: AuthTokens): void => {
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INSTANCE AXIOS
// ═══════════════════════════════════════════════════════════════════════════════

const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Flag pour éviter les refresh en boucle
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token!);
      }
    });
    failedQueue = [];
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUEST INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════════════════

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSE INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════════════════

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorResponse>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Si 401 et pas déjà en retry
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // Mettre la requête en file d'attente
          return new Promise((resolve, reject) => {
            failedQueue.push({
              resolve: (token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(instance(originalRequest));
              },
              reject: (err: any) => {
                reject(err);
              },
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) {
          // Pas de refresh token, déconnecter
          tokenStorage.clearTokens();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          tokenStorage.setTokens({ accessToken, refreshToken: newRefreshToken });

          processQueue(null, accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          tokenStorage.clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Formater l'erreur
      const formattedError = formatError(error);
      return Promise.reject(formattedError);
    }
  );

  return instance;
};

// ═══════════════════════════════════════════════════════════════════════════════
// GESTION DES ERREURS
// ═══════════════════════════════════════════════════════════════════════════════

class ApiError extends Error {
  public code?: string;
  public status?: number;
  public details?: Record<string, any>;

  constructor(message: string, code?: string, status?: number, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const formatError = (error: AxiosError<ApiErrorResponse>): ApiError => {
  if (error.response) {
    const { data, status } = error.response;
    return new ApiError(
      data?.message || 'Une erreur est survenue',
      data?.code,
      status,
      data?.details
    );
  }

  if (error.request) {
    return new ApiError(
      'Impossible de contacter le serveur. Vérifiez votre connexion.',
      'NETWORK_ERROR'
    );
  }

  return new ApiError(error.message || 'Une erreur inattendue est survenue');
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES API
// ═══════════════════════════════════════════════════════════════════════════════

export const api = createApiInstance();

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  logout: () => {
    const refreshToken = tokenStorage.getRefreshToken();
    return api.post('/auth/logout', { refreshToken }).finally(() => {
      tokenStorage.clearTokens();
    });
  },

  getProfile: () => api.get('/auth/profile'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Customers
export const customersApi = {
  list: (params?: Record<string, any>) => api.get('/customers', { params }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.patch(`/customers/${id}`, data),
  updateCredit: (id: string, creditLimit: number, creditLimitEnabled: boolean) =>
    api.patch(`/customers/${id}/credit`, { creditLimit, creditLimitEnabled }),
  getStatement: (id: string, startDate: string, endDate: string) =>
    api.get(`/customers/${id}/statement`, { params: { startDate, endDate } }),
  getDebtHistory: (id: string) => api.get(`/customers/${id}/debt-history`),
};

// Products
export const productsApi = {
  list: (params?: Record<string, any>) => api.get('/products', { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.patch(`/products/${id}`, data),
  updateStock: (id: string, quantity: number, type: 'add' | 'remove' | 'set', reason?: string) =>
    api.patch(`/products/${id}/stock`, { quantity, type, reason }),
  updatePrice: (id: string, basePrice: number, discountPrice?: number, discountEndDate?: string) =>
    api.patch(`/products/${id}/price`, { basePrice, discountPrice, discountEndDate }),
};

// Categories
export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.patch(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Orders
export const ordersApi = {
  list: (params?: Record<string, any>) => api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.patch(`/orders/${id}`, data),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/orders/${id}/status`, { status, reason }),
  cancel: (id: string, reason: string) => api.post(`/orders/${id}/cancel`, { reason }),
  getStats: (params?: Record<string, any>) => api.get('/orders/stats', { params }),
};

// Deliveries
export const deliveriesApi = {
  list: (params?: Record<string, any>) => api.get('/deliveries', { params }),
  get: (id: string) => api.get(`/deliveries/${id}`),
  assign: (delivererId: string, orderIds: string[], date?: string) =>
    api.post('/deliveries/assign', { delivererId, orderIds, date }),
  getRoute: (delivererId: string, date: string) =>
    api.get(`/deliveries/route/${delivererId}`, { params: { date } }),
};

// Daily Cash
export const dailyCashApi = {
  list: (params?: Record<string, any>) => api.get('/daily-cash', { params }),
  get: (id: string) => api.get(`/daily-cash/${id}`),
  getByDeliverer: (delivererId: string, date: string) =>
    api.get(`/daily-cash/deliverer/${delivererId}`, { params: { date } }),
};

// Dashboard
export const dashboardApi = {
  getOverview: () => api.get('/dashboard/overview'),
  getSalesStats: (startDate: string, endDate: string, groupBy?: string) =>
    api.get('/dashboard/sales', { params: { startDate, endDate, groupBy } }),
  getTopProducts: (startDate: string, endDate: string, limit?: number) =>
    api.get('/dashboard/top-products', { params: { startDate, endDate, limit } }),
  getTopCustomers: (startDate: string, endDate: string, limit?: number) =>
    api.get('/dashboard/top-customers', { params: { startDate, endDate, limit } }),
  getDelivererPerformance: (startDate: string, endDate: string) =>
    api.get('/dashboard/deliverer-performance', { params: { startDate, endDate } }),
  getStockAlerts: () => api.get('/dashboard/stock-alerts'),
  getDebtAgingReport: () => api.get('/dashboard/debt-aging'),
};

// Reports
export const reportsApi = {
  getDailyReport: (date: string) => api.get('/reports/daily', { params: { date } }),
  getWeeklyReport: (weekStart: string) => api.get('/reports/weekly', { params: { weekStart } }),
  getMonthlyReport: (year: number, month: number) =>
    api.get('/reports/monthly', { params: { year, month } }),
  exportToExcel: (type: string, params: Record<string, any>) =>
    api.get(`/reports/export/${type}`, { params, responseType: 'blob' }),
};

// Users
export const usersApi = {
  list: (params?: Record<string, any>) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  getDeliverers: () => api.get('/users/deliverers'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { ApiError };
export default api;
