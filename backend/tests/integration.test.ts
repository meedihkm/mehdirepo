// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - TESTS D'INTÉGRATION API
// Tests end-to-end des endpoints API
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/database';
import { users, customers, products, orders } from '../src/database/schema';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

let authToken: string;
let testOrganizationId: string;
let testUserId: string;
let testCustomerId: string;
let testProductId: string;

const testUser = {
  email: 'test@awid.dz',
  password: 'test123456',
  name: 'Test Admin',
  role: 'admin' as const,
};

beforeAll(async () => {
  // Créer organisation de test
  testOrganizationId = 'test-org-' + Date.now();

  // Créer utilisateur de test
  const hashedPassword = await bcrypt.hash(testUser.password, 10);
  const [user] = await db.insert(users).values({
    id: 'test-user-' + Date.now(),
    organizationId: testOrganizationId,
    email: testUser.email,
    passwordHash: hashedPassword,
    name: testUser.name,
    role: testUser.role,
  }).returning();
  testUserId = user.id;

  // Générer token
  authToken = jwt.sign(
    { userId: testUserId, organizationId: testOrganizationId, role: testUser.role },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  // Nettoyer les données de test
  await db.delete(orders).where(eq(orders.organizationId, testOrganizationId));
  await db.delete(customers).where(eq(customers.organizationId, testOrganizationId));
  await db.delete(products).where(eq(products.organizationId, testOrganizationId));
  await db.delete(users).where(eq(users.organizationId, testOrganizationId));
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS AUTH
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalidemail',
          password: 'password123',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.name).toBe(testUser.name);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Customers API', () => {
  const testCustomer = {
    code: 'TEST001',
    name: 'Client Test',
    phone: '0555123456',
    address: '123 Rue Test, Alger',
    category: 'normal',
  };

  describe('POST /api/customers', () => {
    it('should create a new customer', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testCustomer);

      expect(response.status).toBe(201);
      expect(response.body.data.code).toBe(testCustomer.code);
      expect(response.body.data.name).toBe(testCustomer.name);
      testCustomerId = response.body.data.id;
    });

    it('should reject duplicate customer code', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testCustomer);

      expect(response.status).toBe(409);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Missing Fields' });

      expect(response.status).toBe(400);
    });

    it('should validate phone format', async () => {
      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...testCustomer,
          code: 'TEST002',
          phone: 'invalid',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/customers', () => {
    it('should list customers with pagination', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter customers by search', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Test' });

      expect(response.status).toBe(200);
      expect(response.body.data.some((c: any) => c.name.includes('Test'))).toBe(true);
    });
  });

  describe('GET /api/customers/:id', () => {
    it('should return customer details', async () => {
      const response = await request(app)
        .get(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testCustomerId);
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/customers/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/customers/:id', () => {
    it('should update customer', async () => {
      const response = await request(app)
        .patch(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Client Test Updated' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Client Test Updated');
    });
  });

  describe('PATCH /api/customers/:id/credit', () => {
    it('should update credit limit', async () => {
      const response = await request(app)
        .patch(`/api/customers/${testCustomerId}/credit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          creditLimitEnabled: true,
          creditLimit: 50000,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.creditLimit).toBe(50000);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Products API', () => {
  const testProduct = {
    sku: 'PROD001',
    name: 'Pain de Campagne',
    categoryId: 'test-category',
    unit: 'pièce',
    basePrice: 50,
    stockQuantity: 100,
    minStockLevel: 10,
  };

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testProduct);

      expect(response.status).toBe(201);
      expect(response.body.data.sku).toBe(testProduct.sku);
      testProductId = response.body.data.id;
    });
  });

  describe('GET /api/products', () => {
    it('should list products', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ categoryId: testProduct.categoryId });

      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /api/products/:id/stock', () => {
    it('should add stock', async () => {
      const response = await request(app)
        .patch(`/api/products/${testProductId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'add',
          quantity: 50,
          reason: 'Réapprovisionnement',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stockQuantity).toBe(150);
    });

    it('should remove stock', async () => {
      const response = await request(app)
        .patch(`/api/products/${testProductId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'remove',
          quantity: 30,
          reason: 'Vente directe',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stockQuantity).toBe(120);
    });

    it('should reject negative stock', async () => {
      const response = await request(app)
        .patch(`/api/products/${testProductId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'remove',
          quantity: 500,
        });

      expect(response.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Orders API', () => {
  let testOrderId: string;

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: testCustomerId,
          items: [
            {
              productId: testProductId,
              quantity: 10,
              unitPrice: 50,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.orderNumber).toBeDefined();
      expect(response.body.data.totalAmount).toBe(500);
      testOrderId = response.body.data.id;
    });

    it('should validate items required', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: testCustomerId,
          items: [],
        });

      expect(response.status).toBe(400);
    });

    it('should check credit limit', async () => {
      // D'abord, définir une limite de crédit basse
      await request(app)
        .patch(`/api/customers/${testCustomerId}/credit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          creditLimitEnabled: true,
          creditLimit: 100,
        });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: testCustomerId,
          items: [
            {
              productId: testProductId,
              quantity: 100,
              unitPrice: 50,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('crédit');
    });
  });

  describe('GET /api/orders', () => {
    it('should list orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
    });

    it('should filter by customer', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ customerId: testCustomerId });

      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('should update order status', async () => {
      const response = await request(app)
        .patch(`/api/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'confirmed' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('confirmed');
    });

    it('should record status history', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.data.statusHistory.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel order with reason', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Client absent' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should not cancel delivered order', async () => {
      // Créer une commande livrée
      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: testCustomerId,
          items: [{ productId: testProductId, quantity: 1, unitPrice: 50 }],
        });

      const orderId = createResponse.body.data.id;

      // La marquer comme livrée
      await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'delivered' });

      // Essayer de l'annuler
      const cancelResponse = await request(app)
        .post(`/api/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test' });

      expect(cancelResponse.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dashboard API', () => {
  describe('GET /api/dashboard/overview', () => {
    it('should return dashboard overview', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('todayOrders');
      expect(response.body.data).toHaveProperty('todayRevenue');
      expect(response.body.data).toHaveProperty('pendingOrders');
    });
  });

  describe('GET /api/dashboard/sales', () => {
    it('should return sales data', async () => {
      const response = await request(app)
        .get('/api/dashboard/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER - Import eq from drizzle
// ═══════════════════════════════════════════════════════════════════════════════

import { eq } from 'drizzle-orm';
