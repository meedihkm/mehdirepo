// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE D'IMPRESSION
// Bons de livraison, reçus, relevés - Format thermal et PDF
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '../database';
import { deliveries, orders, customers, paymentHistory, organizations } from '../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { config } from '../config';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ThermalLine {
  type: 'text' | 'header' | 'divider' | 'qr' | 'barcode';
  content?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: 'small' | 'normal' | 'large';
  data?: string; // Pour QR/barcode
}

export interface PrintTemplate {
  title: string;
  lines: ThermalLine[];
}

export interface PrintResult {
  success: boolean;
  url?: string;
  thermalData?: ThermalLine[];
  pdfBuffer?: Buffer;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PrintService {
  
  // ───────────────────────────────────────────────────────────────────────────
  // BON DE LIVRAISON - FORMAT THERMAL
  // ───────────────────────────────────────────────────────────────────────────
  
  async generateDeliveryNoteThermal(deliveryId: string): Promise<PrintResult> {
    try {
      const delivery = await db.query.deliveries.findFirst({
        where: eq(deliveries.id, deliveryId),
        with: {
          order: {
            with: {
              customer: true,
              items: {
                with: {
                  product: true,
                },
              },
            },
          },
          deliverer: true,
        },
      });
      
      if (!delivery) {
        return { success: false, error: 'Livraison non trouvée' };
      }
      
      const order = delivery.order!;
      const customer = order.customer!;
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, delivery.organizationId),
      });
      
      const printSettings = (org?.printSettings as any) || {};
      const lines: ThermalLine[] = [];
      
      // En-tête
      lines.push({ type: 'header', content: org?.name || 'AWID', align: 'center', bold: true, size: 'large' });
      
      if (printSettings.headerLine1) {
        lines.push({ type: 'text', content: printSettings.headerLine1, align: 'center' });
      }
      if (printSettings.headerLine2) {
        lines.push({ type: 'text', content: printSettings.headerLine2, align: 'center' });
      }
      
      lines.push({ type: 'divider' });
      lines.push({ type: 'header', content: 'BON DE LIVRAISON', align: 'center', bold: true });
      lines.push({ type: 'text', content: `N° ${order.orderNumber}`, align: 'center' });
      lines.push({ type: 'divider' });
      
      // Date et livreur
      lines.push({ type: 'text', content: `Date: ${new Date().toLocaleDateString('fr-FR')}` });
      lines.push({ type: 'text', content: `Livreur: ${delivery.deliverer?.name || 'N/A'}` });
      lines.push({ type: 'divider' });
      
      // Client
      lines.push({ type: 'header', content: 'CLIENT', bold: true });
      lines.push({ type: 'text', content: customer.name });
      lines.push({ type: 'text', content: customer.address });
      lines.push({ type: 'text', content: `Tél: ${customer.phone}` });
      lines.push({ type: 'divider' });
      
      // Articles
      lines.push({ type: 'header', content: 'ARTICLES', bold: true });
      
      for (const item of order.items) {
        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const total = Number(item.totalPrice);
        
        lines.push({
          type: 'text',
          content: `${item.productName}`,
        });
        lines.push({
          type: 'text',
          content: `  ${qty} x ${price.toFixed(2)} = ${total.toFixed(2)} DZD`,
          align: 'right',
        });
      }
      
      lines.push({ type: 'divider' });
      
      // Totaux
      lines.push({
        type: 'text',
        content: `Sous-total: ${Number(order.subtotal).toFixed(2)} DZD`,
        align: 'right',
      });
      
      if (Number(order.discountAmount) > 0) {
        lines.push({
          type: 'text',
          content: `Remise: -${Number(order.discountAmount).toFixed(2)} DZD`,
          align: 'right',
        });
      }
      
      lines.push({
        type: 'header',
        content: `TOTAL: ${Number(order.total).toFixed(2)} DZD`,
        align: 'right',
        bold: true,
        size: 'large',
      });
      
      // Dette si activé
      if (printSettings.showDebtOnReceipt) {
        lines.push({ type: 'divider' });
        lines.push({
          type: 'text',
          content: `Dette actuelle: ${Number(customer.currentDebt).toFixed(2)} DZD`,
          align: 'right',
        });
      }
      
      // QR Code
      lines.push({ type: 'divider' });
      lines.push({ type: 'qr', data: deliveryId, align: 'center' });
      lines.push({ type: 'text', content: 'Scannez pour vérifier', align: 'center', size: 'small' });
      
      // Pied de page
      if (printSettings.footerText) {
        lines.push({ type: 'divider' });
        lines.push({ type: 'text', content: printSettings.footerText, align: 'center', size: 'small' });
      }
      
      lines.push({ type: 'text', content: '--- Merci de votre confiance ---', align: 'center', size: 'small' });
      
      return {
        success: true,
        thermalData: lines,
      };
    } catch (error) {
      logger.error('Failed to generate delivery note:', error);
      return { success: false, error: 'Erreur de génération' };
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // REÇU DE PAIEMENT - FORMAT THERMAL
  // ───────────────────────────────────────────────────────────────────────────
  
  async generateReceiptThermal(paymentId: string): Promise<PrintResult> {
    try {
      const payment = await db.query.paymentHistory.findFirst({
        where: eq(paymentHistory.id, paymentId),
        with: {
          customer: true,
          order: true,
          collectedByUser: true,
        },
      });
      
      if (!payment) {
        return { success: false, error: 'Paiement non trouvé' };
      }
      
      const customer = payment.customer!;
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, payment.organizationId),
      });
      
      const printSettings = (org?.printSettings as any) || {};
      const lines: ThermalLine[] = [];
      
      // En-tête
      lines.push({ type: 'header', content: org?.name || 'AWID', align: 'center', bold: true, size: 'large' });
      
      if (printSettings.headerLine1) {
        lines.push({ type: 'text', content: printSettings.headerLine1, align: 'center' });
      }
      
      lines.push({ type: 'divider' });
      lines.push({ type: 'header', content: 'REÇU DE PAIEMENT', align: 'center', bold: true });
      lines.push({ type: 'text', content: `N° ${payment.receiptNumber || payment.id.slice(0, 8)}`, align: 'center' });
      lines.push({ type: 'divider' });
      
      // Date
      lines.push({ type: 'text', content: `Date: ${new Date(payment.collectedAt || payment.createdAt).toLocaleString('fr-FR')}` });
      lines.push({ type: 'divider' });
      
      // Client
      lines.push({ type: 'header', content: 'CLIENT', bold: true });
      lines.push({ type: 'text', content: customer.name });
      lines.push({ type: 'text', content: `Tél: ${customer.phone}` });
      lines.push({ type: 'divider' });
      
      // Détails du paiement
      lines.push({ type: 'header', content: 'DÉTAILS', bold: true });
      
      if (payment.orderId) {
        lines.push({ type: 'text', content: `Commande: ${payment.order?.orderNumber || 'N/A'}` });
      }
      
      lines.push({ type: 'text', content: `Type: ${this.translatePaymentType(payment.paymentType)}` });
      lines.push({ type: 'text', content: `Mode: ${this.translatePaymentMode(payment.mode)}` });
      
      if (payment.checkNumber) {
        lines.push({ type: 'text', content: `Chèque N°: ${payment.checkNumber}` });
        if (payment.checkBank) {
          lines.push({ type: 'text', content: `Banque: ${payment.checkBank}` });
        }
      }
      
      lines.push({ type: 'divider' });
      
      // Montant
      lines.push({
        type: 'header',
        content: `MONTANT: ${Number(payment.amount).toFixed(2)} DZD`,
        align: 'center',
        bold: true,
        size: 'large',
      });
      
      // Dette avant/après
      if (payment.customerDebtBefore !== null && payment.customerDebtAfter !== null) {
        lines.push({ type: 'divider' });
        lines.push({ type: 'text', content: `Dette avant: ${Number(payment.customerDebtBefore).toFixed(2)} DZD` });
        lines.push({ type: 'text', content: `Dette après: ${Number(payment.customerDebtAfter).toFixed(2)} DZD` });
      }
      
      // Collecteur
      if (payment.collectedByUser) {
        lines.push({ type: 'divider' });
        lines.push({ type: 'text', content: `Reçu par: ${payment.collectedByUser.name}`, size: 'small' });
      }
      
      // QR Code
      lines.push({ type: 'divider' });
      lines.push({ type: 'qr', data: paymentId, align: 'center' });
      
      // Pied de page
      if (printSettings.footerText) {
        lines.push({ type: 'divider' });
        lines.push({ type: 'text', content: printSettings.footerText, align: 'center', size: 'small' });
      }
      
      return {
        success: true,
        thermalData: lines,
      };
    } catch (error) {
      logger.error('Failed to generate receipt:', error);
      return { success: false, error: 'Erreur de génération' };
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // RELEVÉ CLIENT - FORMAT THERMAL
  // ───────────────────────────────────────────────────────────────────────────
  
  async generateStatementThermal(customerId: string, startDate?: Date, endDate?: Date): Promise<PrintResult> {
    try {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });
      
      if (!customer) {
        return { success: false, error: 'Client non trouvé' };
      }
      
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, customer.organizationId),
      });
      
      // Récupérer les transactions
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();
      
      const payments = await db.query.paymentHistory.findMany({
        where: and(
          eq(paymentHistory.customerId, customerId),
          sql`${paymentHistory.createdAt} >= ${start}`,
          sql`${paymentHistory.createdAt} <= ${end}`
        ),
        orderBy: [sql`${paymentHistory.createdAt} DESC`],
      });
      
      const orders = await db.query.orders.findMany({
        where: and(
          eq(orders.customerId, customerId),
          sql`${orders.createdAt} >= ${start}`,
          sql`${orders.createdAt} <= ${end}`
        ),
        orderBy: [sql`${orders.createdAt} DESC`],
      });
      
      const lines: ThermalLine[] = [];
      
      // En-tête
      lines.push({ type: 'header', content: org?.name || 'AWID', align: 'center', bold: true, size: 'large' });
      lines.push({ type: 'divider' });
      lines.push({ type: 'header', content: 'RELEVÉ DE COMPTE', align: 'center', bold: true });
      lines.push({ type: 'text', content: `Période: ${start.toLocaleDateString('fr-FR')} - ${end.toLocaleDateString('fr-FR')}`, align: 'center' });
      lines.push({ type: 'divider' });
      
      // Client
      lines.push({ type: 'header', content: 'CLIENT', bold: true });
      lines.push({ type: 'text', content: customer.name });
      lines.push({ type: 'text', content: customer.address });
      lines.push({ type: 'text', content: `Tél: ${customer.phone}` });
      lines.push({ type: 'divider' });
      
      // Solde
      lines.push({
        type: 'header',
        content: `SOLDE ACTUEL: ${Number(customer.currentDebt).toFixed(2)} DZD`,
        align: 'center',
        bold: true,
      });
      lines.push({ type: 'divider' });
      
      // Transactions
      lines.push({ type: 'header', content: 'TRANSACTIONS', bold: true });
      
      // Fusionner et trier les transactions
      const transactions = [
        ...orders.map(o => ({ ...o, type: 'order' as const })),
        ...payments.map(p => ({ ...p, type: 'payment' as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      for (const tx of transactions.slice(0, 20)) { // Limiter à 20 pour le thermal
        if (tx.type === 'order') {
          lines.push({
            type: 'text',
            content: `${new Date(tx.createdAt).toLocaleDateString('fr-FR')} - Commande ${tx.orderNumber}`,
            size: 'small',
          });
          lines.push({
            type: 'text',
            content: `  +${Number(tx.total).toFixed(2)} DZD`,
            align: 'right',
          });
        } else {
          lines.push({
            type: 'text',
            content: `${new Date(tx.createdAt).toLocaleDateString('fr-FR')} - Paiement`,
            size: 'small',
          });
          lines.push({
            type: 'text',
            content: `  -${Number(tx.amount).toFixed(2)} DZD`,
            align: 'right',
          });
        }
      }
      
      if (transactions.length > 20) {
        lines.push({ type: 'text', content: `... et ${transactions.length - 20} autres transactions`, align: 'center', size: 'small' });
      }
      
      lines.push({ type: 'divider' });
      lines.push({ type: 'text', content: '--- Fin du relevé ---', align: 'center', size: 'small' });
      
      return {
        success: true,
        thermalData: lines,
      };
    } catch (error) {
      logger.error('Failed to generate statement:', error);
      return { success: false, error: 'Erreur de génération' };
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // PDF - Génération (placeholder pour implémentation future)
  // ───────────────────────────────────────────────────────────────────────────
  
  async generateDeliveryNotePDF(deliveryId: string): Promise<PrintResult> {
    // TODO: Implémenter génération PDF avec PDFKit ou Puppeteer
    logger.info(`PDF generation requested for delivery ${deliveryId}`);
    return {
      success: true,
      url: `/api/print/delivery/${deliveryId}/pdf`,
    };
  }
  
  async generateReceiptPDF(paymentId: string): Promise<PrintResult> {
    logger.info(`PDF generation requested for payment ${paymentId}`);
    return {
      success: true,
      url: `/api/print/receipt/${paymentId}/pdf`,
    };
  }
  
  async generateStatementPDF(customerId: string, startDate?: Date, endDate?: Date): Promise<PrintResult> {
    logger.info(`PDF generation requested for customer ${customerId}`);
    return {
      success: true,
      url: `/api/print/statement/${customerId}/pdf`,
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  
  private translatePaymentType(type: string): string {
    const translations: Record<string, string> = {
      order_payment: 'Paiement commande',
      debt_payment: 'Remboursement dette',
      advance_payment: 'Avance',
      refund: 'Remboursement',
    };
    return translations[type] || type;
  }
  
  private translatePaymentMode(mode: string): string {
    const translations: Record<string, string> = {
      cash: 'Espèces',
      check: 'Chèque',
      bank_transfer: 'Virement',
      mobile_payment: 'Mobile',
    };
    return translations[mode] || mode;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // CONVERSION POUR IMPRIMANTE BLUETOOTH
  // ───────────────────────────────────────────────────────────────────────────
  
  convertToESCPos(lines: ThermalLine[]): Buffer {
    // TODO: Implémenter conversion en commandes ESC/POS
    // Pour l'instant, retourner un buffer texte simple
    let text = '';
    
    for (const line of lines) {
      switch (line.type) {
        case 'header':
          text += `\n${line.content.toUpperCase()}\n`;
          break;
        case 'divider':
          text += '--------------------------------\n';
          break;
        case 'qr':
          text += `[QR: ${line.data}]\n`;
          break;
        case 'text':
        default:
          text += `${line.content}\n`;
      }
    }
    
    return Buffer.from(text, 'utf-8');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const printService = new PrintService();

export default printService;
