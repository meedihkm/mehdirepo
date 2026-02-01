// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - WEBSOCKET CONTEXT
// Gestion de la connexion Socket.IO et des notifications en temps réel
// ═══════════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationType = 'order' | 'delivery' | 'payment' | 'system' | 'new_order' | 'delivery_completed' | 'delivery_failed' | 'payment_received' | 'low_stock';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  body?: string;
  data?: any;
  read: boolean;
  isRead?: boolean;
  createdAt: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ─── Connexion Socket.IO ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Déconnecter si l'utilisateur n'est plus authentifié
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Événements de connexion
    newSocket.on('connect', () => {
      console.log('[WebSocket] Connecté');
      setIsConnected(true);
      
      // Rejoindre la room de l'organisation
      if (user.organizationId) {
        newSocket.emit('join:organization', user.organizationId);
        console.log(`[WebSocket] Rejoint l'organisation: ${user.organizationId}`);
      }

      // Rejoindre la room personnelle
      newSocket.emit('join:user', user.id);
      console.log(`[WebSocket] Rejoint l'utilisateur: ${user.id}`);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Déconnecté:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Erreur de connexion:', error.message);
      setIsConnected(false);
    });

    // ─── Événements de notification ────────────────────────────────────────────

    // Notification générique
    newSocket.on('notification', (notification: Notification) => {
      console.log('[WebSocket] Notification reçue:', notification);
      const normalizedNotification = normalizeNotification(notification);
      setNotifications((prev) => [normalizedNotification, ...prev]);
    });

    // Nouvelle commande
    newSocket.on('order:created', (data) => {
      console.log('[WebSocket] Nouvelle commande:', data);
      const notification: Notification = {
        id: `order-${data.id}-${Date.now()}`,
        type: 'new_order',
        title: 'Nouvelle commande',
        message: `Commande #${data.id?.slice(-6) || data.orderNumber} de ${data.customerName || data.customer?.name || 'Client'}`,
        body: `Commande #${data.id?.slice(-6) || data.orderNumber} de ${data.customerName || data.customer?.name || 'Client'}`,
        data,
        read: false,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev]);
    });

    // Commande mise à jour
    newSocket.on('order:updated', (data) => {
      console.log('[WebSocket] Commande mise à jour:', data);
      const notification: Notification = {
        id: `order-update-${data.id}-${Date.now()}`,
        type: 'order',
        title: 'Commande mise à jour',
        message: `Statut: ${data.status}`,
        body: `La commande #${data.id?.slice(-6) || data.orderNumber} est maintenant ${data.status}`,
        data,
        read: false,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev]);
    });

    // Livraison complétée
    newSocket.on('delivery:completed', (data) => {
      console.log('[WebSocket] Livraison terminée:', data);
      const notification: Notification = {
        id: `delivery-${data.id}-${Date.now()}`,
        type: 'delivery_completed',
        title: 'Livraison terminée',
        message: `Livraison #${data.id?.slice(-6)} complétée`,
        body: `Livraison #${data.id?.slice(-6)} complétée par ${data.delivererName || data.deliverer?.name || 'livreur'}`,
        data,
        read: false,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev]);
    });

    // Livraison échouée
    newSocket.on('delivery:failed', (data) => {
      console.log('[WebSocket] Livraison échouée:', data);
      const notification: Notification = {
        id: `delivery-failed-${data.id}-${Date.now()}`,
        type: 'delivery_failed',
        title: 'Livraison échouée',
        message: `La livraison #${data.id?.slice(-6)} a échoué`,
        body: data.reason || 'Raison non spécifiée',
        data,
        read: false,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev]);
    });

    // Paiement reçu
    newSocket.on('payment:received', (data) => {
      console.log('[WebSocket] Paiement reçu:', data);
      const notification: Notification = {
        id: `payment-${data.id}-${Date.now()}`,
        type: 'payment_received',
        title: 'Paiement reçu',
        message: `Paiement de ${data.amount?.toFixed(2) || data.amount} ${data.currency || '€'}`,
        body: `Pour la commande #${data.orderId?.slice(-6) || data.orderNumber}`,
        data,
        read: false,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev]);
    });

    // Stock bas
    newSocket.on('stock:low', (data) => {
      console.log('[WebSocket] Stock bas:', data);
      const notification: Notification = {
        id: `stock-${data.productId}-${Date.now()}`,
        type: 'low_stock',
        title: 'Stock bas',
        message: `${data.productName || data.name} - Stock: ${data.quantity}`,
        body: `Le produit ${data.productName || data.name} est en stock faible (${data.quantity} restants)`,
        data,
        read: false,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notification, ...prev]);
    });

    setSocket(newSocket);

    return () => {
      console.log('[WebSocket] Fermeture de la connexion');
      newSocket.close();
    };
  }, [isAuthenticated, user]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const normalizeNotification = (notification: Partial<Notification>): Notification => {
    return {
      id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: notification.type || 'system',
      title: notification.title || 'Notification',
      message: notification.message || notification.body || '',
      body: notification.body || notification.message || '',
      data: notification.data,
      read: notification.read ?? notification.isRead ?? false,
      isRead: notification.isRead ?? notification.read ?? false,
      createdAt: notification.createdAt || new Date().toISOString(),
    };
  };

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, isRead: true } : n
      )
    );
    
    // Envoyer au serveur que la notification est lue
    if (socket) {
      socket.emit('notification:read', { id });
    }
  }, [socket]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, isRead: true }))
    );
    
    // Envoyer au serveur que toutes les notifications sont lues
    if (socket) {
      socket.emit('notification:readAll');
    }
  }, [socket]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !(n.read || n.isRead)).length;

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket doit être utilisé dans WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
