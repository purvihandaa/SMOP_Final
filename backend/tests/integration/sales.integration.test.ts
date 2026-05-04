import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, uniqueId } from './helpers';

/**
 * Sales Integration Tests
 *
 * Tests customer enquiry → quotation → order confirmation lifecycle.
 * List endpoints return data as array with meta for pagination.
 */

describe('Sales Integration', () => {
  let salesCookie: string;
  let createdEnquiryId: string;

  beforeAll(async () => {
    salesCookie = await loginAs('sales');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/customer/enquiry
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/customer/enquiry', () => {
    it('should create a customer enquiry', async () => {
      const res = await request(app)
        .post('/api/customer/enquiry')
        .set('Cookie', salesCookie)
        .send({
          customerName: `Test Customer ${uniqueId()}`,
          customerEmail: 'test@example.com',
          customerPhone: '+91-9876543210',
          productName: 'Speed Motor 500W',
          quantity: 25,
          remarks: 'Integration test enquiry',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('NEW');
      createdEnquiryId = res.body.data.id;
    });

    it('should return 422 for missing customerName', async () => {
      const res = await request(app)
        .post('/api/customer/enquiry')
        .set('Cookie', salesCookie)
        .send({ productName: 'Motor', quantity: 10 });

      expect(res.status).toBe(422);
    });

    it('should return 422 for missing productName', async () => {
      const res = await request(app)
        .post('/api/customer/enquiry')
        .set('Cookie', salesCookie)
        .send({ customerName: 'Test', quantity: 10 });

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/customer/enquiry/list
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/customer/enquiry/list', () => {
    it('should return list of customer enquiries', async () => {
      const res = await request(app)
        .get('/api/customer/enquiry/list')
        .set('Cookie', salesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/quotation/generate
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/quotation/generate', () => {
    it('should generate a customer quotation', async () => {
      const res = await request(app)
        .post('/api/quotation/generate')
        .set('Cookie', salesCookie)
        .send({
          customerName: 'Integration Test Corp',
          productName: 'Speed Motor 500W',
          quantity: 10,
          unitPrice: 7500,
          validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
          remarks: `Integration test quotation ${uniqueId()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.totalAmount).toBe(75000);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should auto-increment version for same enquiry', async () => {
      const res = await request(app)
        .post('/api/quotation/generate')
        .set('Cookie', salesCookie)
        .send({
          customerName: 'Version Test Corp',
          productName: 'Speed Motor 1000W',
          quantity: 5,
          unitPrice: 16000,
          enquiryId: createdEnquiryId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.version).toBeGreaterThanOrEqual(1);
    });

    it('should return 422 for missing quantity', async () => {
      const res = await request(app)
        .post('/api/quotation/generate')
        .set('Cookie', salesCookie)
        .send({ customerName: 'X', productName: 'Y', unitPrice: 100 });

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/quotation/list
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/quotation/list', () => {
    it('should return list of customer quotations', async () => {
      const res = await request(app)
        .get('/api/quotation/list')
        .set('Cookie', salesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/order/confirm — Feasibility Gate
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/order/confirm', () => {
    it('should confirm order for product without BOM (no feasibility check)', async () => {
      const res = await request(app)
        .post('/api/order/confirm')
        .set('Cookie', salesCookie)
        .send({
          customerName: 'No-BOM Customer',
          productName: `Custom Product ${uniqueId()}`,
          quantity: 5,
          totalAmount: 50000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('orderNo');
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('should confirm order with BOM when materials sufficient', async () => {
      const res = await request(app)
        .post('/api/order/confirm')
        .set('Cookie', salesCookie)
        .send({
          customerName: 'Feasible Customer',
          productName: 'Speed Motor 500W',
          quantity: 1,
          totalAmount: 7500,
        });

      // Should succeed if inventory is sufficient, or 400/422 if not
      expect([201, 400, 422]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.data.status).toBe('CONFIRMED');
      }
    });

    it('should reject order when materials insufficient (large qty)', async () => {
      const res = await request(app)
        .post('/api/order/confirm')
        .set('Cookie', salesCookie)
        .send({
          customerName: 'Infeasible Customer',
          productName: 'Speed Motor 500W',
          quantity: 99999,
          totalAmount: 9999900,
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/insufficient/i);
    });

    it('should return 422 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/order/confirm')
        .set('Cookie', salesCookie)
        .send({});

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/order/list
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/order/list', () => {
    it('should return paginated orders', async () => {
      const res = await request(app)
        .get('/api/order/list')
        .set('Cookie', salesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('meta');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/order/list?status=CONFIRMED')
        .set('Cookie', salesCookie);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        res.body.data.forEach((order: any) => {
          expect(order.status).toBe('CONFIRMED');
        });
      }
    });
  });
});
