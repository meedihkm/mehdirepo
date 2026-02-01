// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - WORKER (Jobs en arrière-plan)
// Notifications, rapports, nettoyage
// ═══════════════════════════════════════════════════════════════════════════════

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { redis } from '../cache';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION DES QUEUES
// ═══════════════════════════════════════════════════════════════════════════════

const connection = {
  host: new URL(config.redis.url).hostname,
  port: parseInt(new URL(config.redis.url).port || '6379'),
  password: new URL(config.redis.url).password || undefined,
};

// Définition des queues
export const queues = {
  notifications: new Queue('notifications', { connection }),
  reports: new Queue('reports', { connection }),
  cleanup: new Queue('cleanup', { connection }),
  sync: new Queue('sync', { connection }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES DE JOBS
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationJobData {
  type: 'push' | 'sms' | 'email';
  recipientId: string;
  recipientType: 'user' | 'customer';
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface ReportJobData {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  organizationId: string;
  startDate: string;
  endDate: string;
  format: 'pdf' | 'xlsx' | 'csv';
  recipientEmail?: string;
}

interface CleanupJobData {
  type: 'expired_tokens' | 'old_notifications' | 'audit_logs';
  olderThanDays: number;
}

interface SyncJobData {
  type: 'initial_download' | 'push_transactions' | 'pull_updates';
  delivererId: string;
  organizationId: string;
  data?: any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSORS
// ═══════════════════════════════════════════════════════════════════════════════

// Processor pour les notifications
const processNotification = async (job: Job<NotificationJobData>): Promise<void> => {
  const { type, recipientId, recipientType, title, body, data } = job.data;

  logger.info(`Processing notification job ${job.id}: ${type} to ${recipientType}:${recipientId}`);

  try {
    switch (type) {
      case 'push':
        await sendPushNotification(recipientId, recipientType, title, body, data);
        break;
      case 'sms':
        await sendSmsNotification(recipientId, recipientType, body);
        break;
      case 'email':
        await sendEmailNotification(recipientId, recipientType, title, body, data);
        break;
    }

    logger.info(`Notification sent successfully: ${job.id}`);
  } catch (error) {
    logger.error(`Failed to send notification ${job.id}:`, error);
    throw error;
  }
};

// Processor pour les rapports
const processReport = async (job: Job<ReportJobData>): Promise<void> => {
  const { type, organizationId, startDate, endDate, format, recipientEmail } = job.data;

  logger.info(`Processing report job ${job.id}: ${type} for org ${organizationId}`);

  try {
    // Générer le rapport
    const report = await generateReport(type, organizationId, startDate, endDate, format);

    // Envoyer par email si demandé
    if (recipientEmail) {
      await sendReportByEmail(recipientEmail, report);
    }

    logger.info(`Report generated successfully: ${job.id}`);
  } catch (error) {
    logger.error(`Failed to generate report ${job.id}:`, error);
    throw error;
  }
};

// Processor pour le nettoyage
const processCleanup = async (job: Job<CleanupJobData>): Promise<void> => {
  const { type, olderThanDays } = job.data;

  logger.info(`Processing cleanup job ${job.id}: ${type} older than ${olderThanDays} days`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    switch (type) {
      case 'expired_tokens':
        await cleanupExpiredTokens(cutoffDate);
        break;
      case 'old_notifications':
        await cleanupOldNotifications(cutoffDate);
        break;
      case 'audit_logs':
        await cleanupAuditLogs(cutoffDate);
        break;
    }

    logger.info(`Cleanup completed: ${job.id}`);
  } catch (error) {
    logger.error(`Failed cleanup ${job.id}:`, error);
    throw error;
  }
};

// Processor pour la synchronisation
const processSync = async (job: Job<SyncJobData>): Promise<void> => {
  const { type, delivererId, organizationId, data } = job.data;

  logger.info(`Processing sync job ${job.id}: ${type} for deliverer ${delivererId}`);

  try {
    switch (type) {
      case 'initial_download':
        await prepareInitialDownload(delivererId, organizationId);
        break;
      case 'push_transactions':
        await processOfflineTransactions(delivererId, organizationId, data);
        break;
      case 'pull_updates':
        await preparePullUpdates(delivererId, organizationId, data?.lastSyncAt);
        break;
    }

    logger.info(`Sync completed: ${job.id}`);
  } catch (error) {
    logger.error(`Failed sync ${job.id}:`, error);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// IMPLÉMENTATIONS DES FONCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendPushNotification(
  recipientId: string,
  recipientType: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!config.notifications.fcm.enabled) {
    logger.warn('FCM not configured, skipping push notification');
    return;
  }

  // TODO: Implémenter l'envoi FCM
  // const token = await getDeviceToken(recipientId, recipientType);
  // await admin.messaging().send({ token, notification: { title, body }, data });
}

async function sendSmsNotification(
  recipientId: string,
  recipientType: string,
  message: string
): Promise<void> {
  if (!config.notifications.sms.enabled) {
    logger.warn('SMS not configured, skipping SMS notification');
    return;
  }

  // TODO: Implémenter l'envoi SMS
  // const phone = await getPhoneNumber(recipientId, recipientType);
  // await smsService.send(phone, message);
}

async function sendEmailNotification(
  recipientId: string,
  recipientType: string,
  subject: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!config.email.enabled) {
    logger.warn('Email not configured, skipping email notification');
    return;
  }

  // TODO: Implémenter l'envoi email
  // const email = await getEmail(recipientId, recipientType);
  // await emailService.send(email, subject, body);
}

async function generateReport(
  type: string,
  organizationId: string,
  startDate: string,
  endDate: string,
  format: string
): Promise<Buffer> {
  // TODO: Implémenter la génération de rapport
  logger.info(`Generating ${type} report for ${organizationId} from ${startDate} to ${endDate}`);
  return Buffer.from('');
}

async function sendReportByEmail(email: string, report: Buffer): Promise<void> {
  // TODO: Envoyer le rapport par email
  logger.info(`Sending report to ${email}`);
}

async function cleanupExpiredTokens(cutoffDate: Date): Promise<void> {
  // Nettoyage géré par Redis TTL
  logger.info('Expired tokens cleanup (handled by Redis TTL)');
}

async function cleanupOldNotifications(cutoffDate: Date): Promise<void> {
  // TODO: Supprimer les anciennes notifications
  logger.info(`Cleaning notifications older than ${cutoffDate.toISOString()}`);
}

async function cleanupAuditLogs(cutoffDate: Date): Promise<void> {
  // TODO: Archiver/supprimer les anciens logs
  logger.info(`Cleaning audit logs older than ${cutoffDate.toISOString()}`);
}

async function prepareInitialDownload(delivererId: string, organizationId: string): Promise<void> {
  // TODO: Préparer les données initiales pour le livreur
  logger.info(`Preparing initial download for deliverer ${delivererId}`);
}

async function processOfflineTransactions(
  delivererId: string,
  organizationId: string,
  transactions: any[]
): Promise<void> {
  // TODO: Traiter les transactions offline
  logger.info(`Processing ${transactions?.length || 0} offline transactions`);
}

async function preparePullUpdates(
  delivererId: string,
  organizationId: string,
  lastSyncAt?: string
): Promise<void> {
  // TODO: Préparer les mises à jour depuis lastSyncAt
  logger.info(`Preparing updates since ${lastSyncAt || 'beginning'}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKERS
// ═══════════════════════════════════════════════════════════════════════════════

let workers: Worker[] = [];

export const initializeWorker = async (): Promise<void> => {
  // Worker notifications
  const notificationWorker = new Worker('notifications', processNotification, {
    connection,
    concurrency: 5,
  });

  notificationWorker.on('completed', (job) => {
    logger.debug(`Notification job ${job.id} completed`);
  });

  notificationWorker.on('failed', (job, error) => {
    logger.error(`Notification job ${job?.id} failed:`, error);
  });

  // Worker rapports
  const reportWorker = new Worker('reports', processReport, {
    connection,
    concurrency: 2,
  });

  reportWorker.on('completed', (job) => {
    logger.debug(`Report job ${job.id} completed`);
  });

  reportWorker.on('failed', (job, error) => {
    logger.error(`Report job ${job?.id} failed:`, error);
  });

  // Worker nettoyage
  const cleanupWorker = new Worker('cleanup', processCleanup, {
    connection,
    concurrency: 1,
  });

  cleanupWorker.on('completed', (job) => {
    logger.debug(`Cleanup job ${job.id} completed`);
  });

  // Worker sync
  const syncWorker = new Worker('sync', processSync, {
    connection,
    concurrency: 10,
  });

  syncWorker.on('completed', (job) => {
    logger.debug(`Sync job ${job.id} completed`);
  });

  workers = [notificationWorker, reportWorker, cleanupWorker, syncWorker];

  // Planifier les jobs récurrents
  await scheduleRecurringJobs();

  logger.info('Workers initialized');
};

export const closeWorkers = async (): Promise<void> => {
  for (const worker of workers) {
    await worker.close();
  }
  logger.info('Workers closed');
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS RÉCURRENTS
// ═══════════════════════════════════════════════════════════════════════════════

async function scheduleRecurringJobs(): Promise<void> {
  // Nettoyage quotidien des tokens expirés
  await queues.cleanup.add(
    'cleanup-tokens',
    { type: 'expired_tokens', olderThanDays: 7 },
    { repeat: { pattern: '0 3 * * *' } } // Tous les jours à 3h
  );

  // Nettoyage hebdomadaire des notifications
  await queues.cleanup.add(
    'cleanup-notifications',
    { type: 'old_notifications', olderThanDays: 30 },
    { repeat: { pattern: '0 4 * * 0' } } // Dimanche à 4h
  );

  logger.info('Recurring jobs scheduled');
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS POUR AJOUTER DES JOBS
// ═══════════════════════════════════════════════════════════════════════════════

export const addNotificationJob = async (
  data: NotificationJobData,
  delay?: number
): Promise<Job> => {
  return queues.notifications.add('notification', data, {
    delay,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
};

export const addReportJob = async (
  data: ReportJobData,
  priority?: number
): Promise<Job> => {
  return queues.reports.add('report', data, {
    priority,
    attempts: 2,
  });
};

export const addSyncJob = async (data: SyncJobData): Promise<Job> => {
  return queues.sync.add('sync', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS BUSINESS
// ═══════════════════════════════════════════════════════════════════════════════

export const notifyOrderCreated = async (
  customerId: string,
  orderNumber: string
): Promise<void> => {
  await addNotificationJob({
    type: 'push',
    recipientId: customerId,
    recipientType: 'customer',
    title: 'Commande reçue',
    body: `Votre commande #${orderNumber} a été reçue et sera traitée prochainement.`,
    data: { type: 'order_created', orderNumber },
  });
};

export const notifyOrderConfirmed = async (
  customerId: string,
  orderNumber: string
): Promise<void> => {
  await addNotificationJob({
    type: 'push',
    recipientId: customerId,
    recipientType: 'customer',
    title: 'Commande confirmée',
    body: `Votre commande #${orderNumber} est confirmée et en préparation.`,
    data: { type: 'order_confirmed', orderNumber },
  });
};

export const notifyDeliveryStarted = async (
  customerId: string,
  orderNumber: string,
  delivererName: string
): Promise<void> => {
  await addNotificationJob({
    type: 'push',
    recipientId: customerId,
    recipientType: 'customer',
    title: 'Livraison en cours',
    body: `${delivererName} est en route pour livrer votre commande #${orderNumber}.`,
    data: { type: 'delivery_started', orderNumber },
  });
};

export const notifyDeliveryCompleted = async (
  customerId: string,
  orderNumber: string,
  amountPaid: number,
  newDebt: number
): Promise<void> => {
  let body = `Votre commande #${orderNumber} a été livrée.`;
  if (newDebt > 0) {
    body += ` Votre solde est de ${newDebt} DZD.`;
  }

  await addNotificationJob({
    type: 'push',
    recipientId: customerId,
    recipientType: 'customer',
    title: 'Livraison effectuée',
    body,
    data: { type: 'delivery_completed', orderNumber, amountPaid, newDebt },
  });
};

export const notifyNewDeliveryAssigned = async (
  delivererId: string,
  customerName: string,
  orderNumber: string
): Promise<void> => {
  await addNotificationJob({
    type: 'push',
    recipientId: delivererId,
    recipientType: 'user',
    title: 'Nouvelle livraison',
    body: `Nouvelle livraison assignée: #${orderNumber} pour ${customerName}`,
    data: { type: 'delivery_assigned', orderNumber },
  });
};

export const notifyCreditLimitAlert = async (
  adminId: string,
  customerName: string,
  currentDebt: number,
  creditLimit: number
): Promise<void> => {
  await addNotificationJob({
    type: 'push',
    recipientId: adminId,
    recipientType: 'user',
    title: 'Alerte limite de crédit',
    body: `${customerName} a atteint ${Math.round(currentDebt / creditLimit * 100)}% de sa limite de crédit.`,
    data: { type: 'credit_limit_alert', customerName, currentDebt, creditLimit },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  initializeWorker,
  closeWorkers,
  queues,
  addNotificationJob,
  addReportJob,
  addSyncJob,
  notifyOrderCreated,
  notifyOrderConfirmed,
  notifyDeliveryStarted,
  notifyDeliveryCompleted,
  notifyNewDeliveryAssigned,
  notifyCreditLimitAlert,
};
