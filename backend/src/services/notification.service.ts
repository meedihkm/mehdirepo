// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE DE NOTIFICATIONS
// Push, SMS, Email - Multi-canal
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '../database';
import { notifications, users, customers, customerAccounts } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { config } from '../config';
import { emitToUser, emitToOrganization } from '../index';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface SendOptions {
  channels?: ('push' | 'sms' | 'email' | 'in_app')[];
  priority?: 'high' | 'normal' | 'low';
  delay?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class NotificationService {
  
  // ───────────────────────────────────────────────────────────────────────────
  // ENVOYER À UN UTILISATEUR (Admin/Livreur)
  // ───────────────────────────────────────────────────────────────────────────
  
  async sendToUser(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    options: SendOptions = {}
  ): Promise<void> {
    try {
      const channels = options.channels || ['push', 'in_app'];
      
      // Sauvegarder dans la base de données
      const [notification] = await db.insert(notifications)
        .values({
          userId,
          type,
          title,
          body,
          data: data || {},
          channel: channels[0],
          isSent: false,
        })
        .returning();
      
      // Émettre via WebSocket pour temps réel
      emitToUser(userId, 'notification:new', {
        id: notification.id,
        type,
        title,
        body,
        data,
        createdAt: notification.createdAt,
      });
      
      // Envoyer push notification si activé
      if (channels.includes('push')) {
        await this.sendPushToUser(userId, title, body, data);
      }
      
      // Marquer comme envoyé
      await db.update(notifications)
        .set({ isSent: true, sentAt: new Date() })
        .where(eq(notifications.id, notification.id));
      
      logger.info(`Notification sent to user ${userId}: ${type}`);
    } catch (error) {
      logger.error('Failed to send notification to user:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // ENVOYER À UN CLIENT (App Client)
  // ───────────────────────────────────────────────────────────────────────────
  
  async sendToCustomer(
    customerId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    options: SendOptions = {}
  ): Promise<void> {
    try {
      const channels = options.channels || ['push', 'in_app'];
      
      // Sauvegarder dans la base de données
      const [notification] = await db.insert(notifications)
        .values({
          customerId,
          type,
          title,
          body,
          data: data || {},
          channel: channels[0],
          isSent: false,
        })
        .returning();
      
      // Envoyer push notification
      if (channels.includes('push')) {
        await this.sendPushToCustomer(customerId, title, body, data);
      }
      
      // Marquer comme envoyé
      await db.update(notifications)
        .set({ isSent: true, sentAt: new Date() })
        .where(eq(notifications.id, notification.id));
      
      logger.info(`Notification sent to customer ${customerId}: ${type}`);
    } catch (error) {
      logger.error('Failed to send notification to customer:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFIER LES ADMINS D'UNE ORGANISATION
  // ───────────────────────────────────────────────────────────────────────────
  
  async notifyAdmin(
    organizationId: string,
    type: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      // Récupérer tous les admins de l'organisation
      const admins = await db.query.users.findMany({
        where: and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'admin'),
          eq(users.isActive, true)
        ),
      });
      
      // Envoyer à chaque admin
      for (const admin of admins) {
        await this.sendToUser(
          admin.id,
          type,
          'Alerte Admin',
          message,
          data,
          { channels: ['push', 'in_app'], priority: 'high' }
        );
      }
      
      // Émettre à la room org:admin pour temps réel
      emitToOrganization(organizationId, 'admin:alert', {
        type,
        message,
        data,
        timestamp: new Date().toISOString(),
      });
      
      logger.info(`Admin notification sent for org ${organizationId}: ${type}`);
    } catch (error) {
      logger.error('Failed to notify admins:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFIER TOUS LES LIVREURS
  // ───────────────────────────────────────────────────────────────────────────
  
  async notifyDeliverers(
    organizationId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const deliverers = await db.query.users.findMany({
        where: and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'deliverer'),
          eq(users.isActive, true)
        ),
      });
      
      for (const deliverer of deliverers) {
        await this.sendToUser(deliverer.id, type, title, body, data);
      }
    } catch (error) {
      logger.error('Failed to notify deliverers:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // PUSH NOTIFICATION - UTILISATEUR
  // ───────────────────────────────────────────────────────────────────────────
  
  private async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!user?.pushTokens || (user.pushTokens as any[]).length === 0) {
        return;
      }
      
      const tokens = user.pushTokens as any[];
      
      for (const tokenData of tokens) {
        await this.sendFCM(tokenData.token, title, body, data);
      }
    } catch (error) {
      logger.error('Failed to send push to user:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // PUSH NOTIFICATION - CLIENT
  // ───────────────────────────────────────────────────────────────────────────
  
  private async sendPushToCustomer(
    customerId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      // Récupérer le compte client avec push token
      const account = await db.query.customerAccounts.findFirst({
        where: eq(customerAccounts.customerId, customerId),
      });
      
      if (!account?.pushToken) {
        return;
      }
      
      await this.sendFCM(account.pushToken, title, body, data);
    } catch (error) {
      logger.error('Failed to send push to customer:', error);
    }
  }
  
  // ─────────────────══════════════════════════════════════════════════════════
  // FCM (FIREBASE CLOUD MESSAGING)
  // ───────────────────────────────────────────────────────────────────────────
  
  private async sendFCM(
    token: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    if (!config.notifications.fcm.enabled) {
      logger.debug('FCM not configured, skipping push notification');
      return;
    }
    
    try {
      // TODO: Implémenter l'appel API FCM
      // Pour l'instant, on log seulement
      logger.info(`FCM would send to ${token}: ${title} - ${body}`);
      
      // Exemple d'implémentation:
      // await fetch('https://fcm.googleapis.com/fcm/send', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `key=${config.notifications.fcm.serverKey}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     to: token,
      //     notification: { title, body },
      //     data: data || {},
      //   }),
      // });
    } catch (error) {
      logger.error('Failed to send FCM:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // SMS
  // ───────────────────────────────────────────────────────────────────────────
  
  async sendSMS(
    phone: string,
    message: string
  ): Promise<void> {
    if (!config.notifications.sms.enabled) {
      logger.debug('SMS not configured, skipping');
      return;
    }
    
    try {
      // TODO: Intégrer fournisseur SMS local
      logger.info(`SMS would send to ${phone}: ${message}`);
    } catch (error) {
      logger.error('Failed to send SMS:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // EMAIL
  // ───────────────────────────────────────────────────────────────────────────
  
  async sendEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    if (!config.email.enabled) {
      logger.debug('Email not configured, skipping');
      return;
    }
    
    try {
      // TODO: Intégrer SMTP
      logger.info(`Email would send to ${to}: ${subject}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // RÉCUPÉRER LES NOTIFICATIONS
  // ───────────────────────────────────────────────────────────────────────────
  
  async getUserNotifications(
    userId: string,
    options: { isRead?: boolean; limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    const { isRead, limit = 20, offset = 0 } = options;
    
    let query = db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, userId),
        isRead !== undefined ? eq(notifications.isRead, isRead) : undefined
      ),
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    });
    
    return query;
  }
  
  async getCustomerNotifications(
    customerId: string,
    options: { isRead?: boolean; limit?: number; offset?: number } = {}
  ): Promise<any[]> {
    const { isRead, limit = 20, offset = 0 } = options;
    
    return db.query.notifications.findMany({
      where: and(
        eq(notifications.customerId, customerId),
        isRead !== undefined ? eq(notifications.isRead, isRead) : undefined
      ),
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    });
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // MARQUER COMME LU
  // ───────────────────────────────────────────────────────────────────────────
  
  async markAsRead(notificationId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, notificationId));
  }
  
  async markAllAsRead(userId?: string, customerId?: string): Promise<void> {
    if (userId) {
      await db.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));
    } else if (customerId) {
      await db.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(notifications.customerId, customerId),
          eq(notifications.isRead, false)
        ));
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // ENREGISTRER PUSH TOKEN
  // ───────────────────────────────────────────────────────────────────────────
  
  async registerUserPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
    deviceId?: string
  ): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) return;
    
    const tokens = (user.pushTokens as any[]) || [];
    
    // Vérifier si le token existe déjà
    const existingIndex = tokens.findIndex(t => t.token === token);
    
    if (existingIndex >= 0) {
      // Mettre à jour
      tokens[existingIndex] = { token, platform, deviceId, updatedAt: new Date() };
    } else {
      // Ajouter
      tokens.push({ token, platform, deviceId, updatedAt: new Date() });
    }
    
    await db.update(users)
      .set({ pushTokens: tokens })
      .where(eq(users.id, userId));
  }
  
  async registerCustomerPushToken(
    customerAccountId: string,
    token: string
  ): Promise<void> {
    await db.update(customerAccounts)
      .set({ pushToken: token })
      .where(eq(customerAccounts.id, customerAccountId));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const notificationService = {
  list: listNotifications,
  getUnreadCount,
  markAsRead: markNotificationAsRead,
  markAllAsRead: markAllNotificationsAsRead,
  registerDeviceToken,
  create: createNotification,
  notifyOrderCreated,
  notifyOrderStatusChanged,
  notifyDeliveryAssigned,
  notifyDeliveryCompleted,
  notifyPaymentReceived,
  notifyDebtReminder,
};

export class NotificationService {
  static list = listNotifications;
  static getUnreadCount = getUnreadCount;
  static markAsRead = markNotificationAsRead;
  static markAllAsRead = markAllNotificationsAsRead;
  static registerDeviceToken = registerDeviceToken;
  static create = createNotification;
  static notifyOrderCreated = notifyOrderCreated;
  static notifyOrderStatusChanged = notifyOrderStatusChanged;
  static notifyDeliveryAssigned = notifyDeliveryAssigned;
  static notifyDeliveryCompleted = notifyDeliveryCompleted;
  static notifyPaymentReceived = notifyPaymentReceived;
  static notifyDebtReminder = notifyDebtReminder;
}

export default notificationService;
