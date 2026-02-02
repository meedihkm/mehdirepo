// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PRINT CONTROLLER
// Méthodes: delivery, receipt, statement (matchent routes/index.ts)
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { orders, customers, organizations, orderItems, products, payments } from '../database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { PrintService } from '../services/print.service';

const printService = new PrintService();

// ─── Helper: charger commande + client + articles ────────────────────────────
async function loadOrderData(orderId: string, organizationId: string) {
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)));
  if (!order) throw new AppError('Commande non trouvée', 404);

  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));

  const items = await db
    .select({
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      discount: orderItems.discount,
      lineTotal: orderItems.lineTotal,
      productName: products.name,
      productSku: products.sku,
      productUnit: products.unit,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  return { order, customer, org, items };
}

// Route: printRoutes.get('/delivery/:id')
export const delivery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    const { format = 'escpos', width = '80' } = req.query;

    const { order, customer, org, items } = await loadOrderData(id, organizationId);

    const noteData = {
      organization: { name: org.name, address: org.address, phone: org.phone },
      order: { orderNumber: order.orderNumber, createdAt: order.createdAt },
      customer: { name: customer.name, phone: customer.phone, address: customer.address },
      items: items.map(i => ({
        name: i.productName || 'Produit',
        quantity: i.quantity,
        unit: i.productUnit || '',
      })),
    };

    if (format === 'html') {
      return res.send(generateDeliveryHtml(noteData));
    }

    const escposData = printService.generateDeliveryNote(noteData);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=BL-${order.orderNumber}.bin`);
    res.send(escposData);
  } catch (error) { next(error); }
};

// Route: printRoutes.get('/receipt/:id')
export const receipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    const { format = 'escpos', width = '80' } = req.query;

    const { order, customer, org, items } = await loadOrderData(id, organizationId);

    const receiptData = {
      organization: {
        name: org.name, address: org.address, phone: org.phone,
        taxId: org.taxId, receiptFooter: org.receiptFooter,
      },
      order: {
        orderNumber: order.orderNumber, createdAt: order.createdAt, status: order.status,
        subtotal: order.subtotal, discount: order.discount, deliveryFee: order.deliveryFee,
        totalAmount: order.total, paidAmount: order.amountPaid,
      },
      customer: { code: customer.code, name: customer.name, phone: customer.phone, address: customer.address },
      items: items.map(i => ({
        name: i.productName || 'Produit', sku: i.productSku || '',
        quantity: i.quantity, unit: i.productUnit || '',
        unitPrice: i.unitPrice, discount: i.discount, lineTotal: i.lineTotal,
      })),
    };

    if (format === 'html') {
      return res.send(generateReceiptHtml(receiptData));
    }

    const escposBuffer = printService.generateOrderReceipt(receiptData, parseInt(width as string, 10));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${order.orderNumber}.bin`);
    res.send(escposBuffer);
  } catch (error) { next(error); }
};

// Route: printRoutes.get('/statement/:id')
export const statement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Charger client
    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
    if (!customer) throw new AppError('Client non trouvé', 404);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));

    const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const end = endDate ? new Date(endDate as string) : new Date();

    // Commandes de la période
    const customerOrders = await db
      .select({
        id: orders.id, orderNumber: orders.orderNumber,
        totalAmount: orders.total, paidAmount: orders.paidAmount,
        status: orders.status, createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        eq(orders.customerId, id),
        gte(orders.createdAt, start), lte(orders.createdAt, end)
      ))
      .orderBy(orders.createdAt);

    // Paiements de la période
    const customerPayments = await db
      .select({
        id: payments.id, amount: payments.amount, mode: payments.mode,
        reference: payments.reference, createdAt: payments.createdAt,
      })
      .from(payments)
      .where(and(
        eq(payments.organizationId, organizationId),
        eq(payments.customerId, id),
        gte(payments.createdAt, start), lte(payments.createdAt, end)
      ))
      .orderBy(payments.createdAt);

    // Générer le relevé ESC/POS
    const statementData = printService.generateStatement({
      organization: { name: org.name, address: org.address, phone: org.phone },
      customer: { code: customer.code, name: customer.name, currentDebt: customer.currentDebt },
      period: { start, end },
      orders: customerOrders,
      payments: customerPayments,
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=releve-${customer.code}.bin`);
    res.send(statementData);
  } catch (error) { next(error); }
};

// ─── HTML GENERATORS ────────────────────────────────────────────────────────

function generateDeliveryHtml(data: any): string {
  const { organization, order, customer, items } = data;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>BL ${order.orderNumber}</title>
<style>body{font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;font-size:13px}
h1{font-size:16px;text-align:center}hr{border:1px dashed #ccc}
table{width:100%;border-collapse:collapse}td,th{padding:4px;text-align:left;border-bottom:1px solid #eee}</style></head>
<body><h1>${organization.name}</h1><p style="text-align:center">${organization.address || ''}<br>${organization.phone || ''}</p><hr>
<p><b>BON DE LIVRAISON</b><br>N°: ${order.orderNumber}<br>Date: ${new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
<p><b>Client:</b> ${customer.name}<br><b>Tél:</b> ${customer.phone}<br><b>Adresse:</b> ${customer.address}</p><hr>
<table><tr><th>Produit</th><th>Qté</th><th>Unité</th></tr>
${items.map((i: any) => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unit}</td></tr>`).join('')}
</table><hr><p style="text-align:center"><br><br>Signature client: _______________<br><br>Signature livreur: _______________</p></body></html>`;
}

function generateReceiptHtml(data: any): string {
  const { organization, order, customer, items } = data;
  const fmt = (v: number) => new Intl.NumberFormat('fr-DZ').format(v) + ' DA';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Reçu ${order.orderNumber}</title>
<style>body{font-family:monospace;max-width:300px;margin:0 auto;padding:10px;font-size:12px}
.c{text-align:center}.r{text-align:right}.b{font-weight:bold}hr{border:none;border-top:1px dashed #000}
table{width:100%;border-collapse:collapse}td{padding:2px 0}</style></head>
<body><div class="c b">${organization.name}</div><div class="c">${organization.address||''}</div>
<div class="c">${organization.phone||''}</div>${organization.taxId?`<div class="c">NIF: ${organization.taxId}</div>`:''}
<hr><div class="b">N°: ${order.orderNumber}</div><div>Date: ${new Date(order.createdAt).toLocaleDateString('fr-FR')}</div>
<div>Client: ${customer.name} (${customer.code})</div><hr><table>
${items.map((i: any) => `<tr><td colspan="2">${i.name}</td></tr><tr><td>${i.quantity} x ${fmt(i.unitPrice)}</td><td class="r">${fmt(i.lineTotal)}</td></tr>`).join('')}
</table><hr><table><tr><td>Sous-total:</td><td class="r">${fmt(order.subtotal)}</td></tr>
${order.discount>0?`<tr><td>Remise:</td><td class="r">-${fmt(order.discount)}</td></tr>`:''}
${order.deliveryFee>0?`<tr><td>Livraison:</td><td class="r">${fmt(order.deliveryFee)}</td></tr>`:''}
<tr class="b" style="border-top:2px solid #000"><td>TOTAL:</td><td class="r">${fmt(order.total)}</td></tr>
<tr><td>Payé:</td><td class="r">${fmt(order.paidAmount)}</td></tr>
${(order.total-order.amountPaid)>0?`<tr class="b"><td>Reste:</td><td class="r">${fmt(order.total-order.amountPaid)}</td></tr>`:''}
</table><hr><div class="c">${organization.receiptFooter||'Merci de votre confiance!'}</div></body></html>`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// STUBS pour compatibilité avec les routes
// ═══════════════════════════════════════════════════════════════════════════════

export const generateDeliveryNotePDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    
    const { order, customer, org, items } = await loadOrderData(id, organizationId);
    const html = generateDeliveryHtml({ organization: org, order, customer, items });
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) { next(error); }
};

export const generateReceiptPDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    
    const { order, customer, org, items } = await loadOrderData(id, organizationId);
    const html = generateReceiptHtml({ organization: org, order, customer, items });
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) { next(error); }
};
