// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE WEBSOCKET
// Communications temps réel pour suivi livraisons et notifications
// ═══════════════════════════════════════════════════════════════════════════════

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../services/auth.service';
import { logger } from '../utils/logger';
import { Redis } from 'ioredis';
import { config } from '../config';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  organizationId?: string;
  role?: string;
  isAlive: boolean;
}

interface WebSocketMessage {
  type: string;
  payload: any;
}

interface BroadcastOptions {
  organizationId?: string;
  userId?: string;
  role?: string;
  excludeUserId?: string;
}

// Types d'événements
export enum WSEventType {
  // Livraisons
  DELIVERY_ASSIGNED = 'delivery:assigned',
  DELIVERY_STARTED = 'delivery:started',
  DELIVERY_POSITION_UPDATE = 'delivery:position',
  DELIVERY_COMPLETED = 'delivery:completed',
  DELIVERY_FAILED = 'delivery:failed',

  // Commandes
  ORDER_CREATED = 'order:created',
  ORDER_STATUS_CHANGED = 'order:status',
  ORDER_CANCELLED = 'order:cancelled',

  // Stock
  STOCK_LOW = 'stock:low',
  STOCK_OUT = 'stock:out',

  // Paiements
  PAYMENT_RECEIVED = 'payment:received',
  DEBT_UPDATED = 'debt:updated',

  // Système
  SYNC_REQUIRED = 'sync:required',
  NOTIFICATION = 'notification',
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private redis: Redis | null = null;
  private subscriber: Redis | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialiser le serveur WebSocket
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    // Connexion Redis pour pub/sub (permet plusieurs instances)
    this.redis = new Redis(config.redis.url);
    this.subscriber = new Redis(config.redis.url);

    // S'abonner aux événements Redis
    this.subscriber.subscribe('ws:broadcast', (err) => {
      if (err) {
        logger.error('Erreur subscription Redis:', err);
      }
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === 'ws:broadcast') {
        try {
          const { event, data, options } = JSON.parse(message);
          this.localBroadcast(event, data, options);
        } catch (e) {
          logger.error('Erreur parsing message Redis:', e);
        }
      }
    });

    // Gérer les connexions
    this.wss.on('connection', this.handleConnection.bind(this));

    // Heartbeat pour détecter les connexions mortes
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  /**
   * Gérer une nouvelle connexion
   */
  private async handleConnection(ws: AuthenticatedWebSocket, req: any): Promise<void> {
    ws.isAlive = true;

    // Extraire le token de l'URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Token requis');
      return;
    }

    try {
      // Vérifier le token
      const decoded = await verifyToken(token);
      ws.userId = decoded.userId;
      ws.organizationId = decoded.organizationId;
      ws.role = decoded.role;

      // Stocker la connexion
      this.clients.set(ws.userId, ws);

      logger.info(`WebSocket connected: user=${ws.userId}, org=${ws.organizationId}`);

      // Envoyer confirmation
      this.send(ws, {
        type: 'connected',
        payload: { userId: ws.userId },
      });

      // Gérer les messages
      ws.on('message', (data) => this.handleMessage(ws, data));

      // Gérer la déconnexion
      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
          logger.info(`WebSocket disconnected: user=${ws.userId}`);
        }
      });

      // Pong pour heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

    } catch (error) {
      logger.error('WebSocket auth error:', error);
      ws.close(4002, 'Token invalide');
    }
  }

  /**
   * Gérer les messages entrants
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: any): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.send(ws, { type: 'pong', payload: {} });
          break;

        case 'position:update':
          // Mise à jour position livreur
          if (ws.role === 'deliverer') {
            this.handlePositionUpdate(ws, message.payload);
          }
          break;

        case 'subscribe':
          // S'abonner à des événements spécifiques
          this.handleSubscribe(ws, message.payload);
          break;

        default:
          logger.debug(`Unknown WS message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WS message:', error);
    }
  }

  /**
   * Gérer la mise à jour de position
   */
  private handlePositionUpdate(
    ws: AuthenticatedWebSocket,
    payload: { latitude: number; longitude: number; accuracy?: number }
  ): void {
    // Diffuser aux admins/managers de l'organisation
    this.broadcast(
      WSEventType.DELIVERY_POSITION_UPDATE,
      {
        delivererId: ws.userId,
        ...payload,
        timestamp: new Date().toISOString(),
      },
      {
        organizationId: ws.organizationId,
        role: 'admin,manager',
        excludeUserId: ws.userId,
      }
    );
  }

  /**
   * Gérer les abonnements
   */
  private handleSubscribe(ws: AuthenticatedWebSocket, payload: { events: string[] }): void {
    // Pour l'instant, tous les utilisateurs reçoivent tous les événements de leur org
    // On pourrait implémenter un système de filtrage plus fin ici
    this.send(ws, {
      type: 'subscribed',
      payload: { events: payload.events },
    });
  }

  /**
   * Envoyer un message à un client
   */
  private send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Diffuser un événement (via Redis pour multi-instance)
   */
  broadcast(event: WSEventType | string, data: any, options: BroadcastOptions = {}): void {
    if (this.redis) {
      this.redis.publish(
        'ws:broadcast',
        JSON.stringify({ event, data, options })
      );
    } else {
      this.localBroadcast(event, data, options);
    }
  }

  /**
   * Diffusion locale (sur cette instance)
   */
  private localBroadcast(
    event: string,
    data: any,
    options: BroadcastOptions
  ): void {
    const message: WebSocketMessage = {
      type: event,
      payload: data,
    };

    for (const [userId, ws] of this.clients) {
      // Filtrer par organisation
      if (options.organizationId && ws.organizationId !== options.organizationId) {
        continue;
      }

      // Filtrer par utilisateur
      if (options.userId && ws.userId !== options.userId) {
        continue;
      }

      // Filtrer par rôle
      if (options.role) {
        const allowedRoles = options.role.split(',');
        if (!ws.role || !allowedRoles.includes(ws.role)) {
          continue;
        }
      }

      // Exclure un utilisateur
      if (options.excludeUserId && ws.userId === options.excludeUserId) {
        continue;
      }

      this.send(ws, message);
    }
  }

  /**
   * Envoyer à un utilisateur spécifique
   */
  sendToUser(userId: string, event: string, data: any): boolean {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      this.send(ws, { type: event, payload: data });
      return true;
    }
    return false;
  }

  /**
   * Heartbeat pour détecter les connexions mortes
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [userId, ws] of this.clients) {
        if (!ws.isAlive) {
          ws.terminate();
          this.clients.delete(userId);
          logger.debug(`Terminated dead connection: ${userId}`);
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, 30000); // Vérifier toutes les 30 secondes
  }

  /**
   * Arrêter le service
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const ws of this.clients.values()) {
      ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();

    if (this.subscriber) {
      this.subscriber.disconnect();
    }

    if (this.redis) {
      this.redis.disconnect();
    }

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }

  /**
   * Statistiques
   */
  getStats(): { connections: number; byOrg: Record<string, number> } {
    const byOrg: Record<string, number> = {};

    for (const ws of this.clients.values()) {
      if (ws.organizationId) {
        byOrg[ws.organizationId] = (byOrg[ws.organizationId] || 0) + 1;
      }
    }

    return {
      connections: this.clients.size,
      byOrg,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS POUR NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const notifyDeliveryAssigned = (
  organizationId: string,
  delivererId: string,
  deliveryCount: number
): void => {
  wsService.broadcast(
    WSEventType.DELIVERY_ASSIGNED,
    { delivererId, count: deliveryCount },
    { organizationId }
  );

  wsService.sendToUser(delivererId, WSEventType.DELIVERY_ASSIGNED, {
    count: deliveryCount,
    message: `${deliveryCount} nouvelle(s) livraison(s) assignée(s)`,
  });
};

export const notifyDeliveryCompleted = (
  organizationId: string,
  delivery: {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    amountCollected: number;
  }
): void => {
  wsService.broadcast(
    WSEventType.DELIVERY_COMPLETED,
    delivery,
    { organizationId, role: 'admin,manager' }
  );
};

export const notifyOrderCreated = (
  organizationId: string,
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    source: string;
  }
): void => {
  wsService.broadcast(
    WSEventType.ORDER_CREATED,
    order,
    { organizationId, role: 'admin,manager,kitchen' }
  );
};

export const notifyStockAlert = (
  organizationId: string,
  product: {
    id: string;
    name: string;
    currentStock: number;
    minStock: number;
  }
): void => {
  const event = product.currentStock === 0 
    ? WSEventType.STOCK_OUT 
    : WSEventType.STOCK_LOW;

  wsService.broadcast(
    event,
    product,
    { organizationId, role: 'admin,manager' }
  );
};

export const notifyPaymentReceived = (
  organizationId: string,
  payment: {
    id: string;
    customerId: string;
    customerName: string;
    amount: number;
    mode: string;
    collectedBy: string;
  }
): void => {
  wsService.broadcast(
    WSEventType.PAYMENT_RECEIVED,
    payment,
    { organizationId, role: 'admin,manager' }
  );
};

export const notifyDebtUpdated = (
  organizationId: string,
  customerId: string,
  newDebt: number
): void => {
  wsService.broadcast(
    WSEventType.DEBT_UPDATED,
    { customerId, currentDebt: newDebt },
    { organizationId, role: 'admin,manager' }
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INSTANCE SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const wsService = new WebSocketService();
export default wsService;
