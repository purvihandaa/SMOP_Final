import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, uniqueId } from './helpers';

/**
 * Supplier Integration Tests
 *
 * Tests enquiry and quotation lifecycle through real HTTP.
 * Note: list endpoints return `data` as an array with `meta` for pagination.
 */

describe('Suppliers Integration', () => {
  let purchaseCookie: string;
  let materialId: string; // a real material ID from DB
  let createdEnquiryId: string;
  let createdQuotationId: string;

  beforeAll(async () => {
    purchaseCookie = await loginAs('purchase');
    // Get a real material ID from the materials list
    const matRes = await request(app)
      .get('/api/material/list')
      .set('Cookie', purchaseCookie);
    materialId = matRes.body.data[0]?.id;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/suppliers/list
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/suppliers/list', () => {
    it('should return list of active suppliers', async () => {
      const res = await request(app)
        .get('/api/suppliers/list')
        .set('Cookie', purchaseCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Enquiry Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  describe('Enquiry Lifecycle', () => {
    it('should create enquiry with DRAFT status', async () => {
      const res = await request(app)
        .post('/api/suppliers/enquiry/create')
        .set('Cookie', purchaseCookie)
        .send({
          supplierId: 'sup-steel-corp',
          items: [{ materialId, quantity: 100, unit: 'pcs' }],
          remarks: `Integration test ${uniqueId()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      createdEnquiryId = res.body.data.id;
    });

    it('should return 422 for missing supplierId', async () => {
      const res = await request(app)
        .post('/api/suppliers/enquiry/create')
        .set('Cookie', purchaseCookie)
        .send({ items: [{ materialId, quantity: 10 }] });

      expect(res.status).toBe(422);
    });

    it('should transition DRAFT → SENT', async () => {
      const res = await request(app)
        .put('/api/suppliers/enquiry/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdEnquiryId, status: 'SENT' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SENT');
    });

    it('should transition SENT → RESPONDED', async () => {
      const res = await request(app)
        .put('/api/suppliers/enquiry/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdEnquiryId, status: 'RESPONDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESPONDED');
    });

    it('should transition RESPONDED → CLOSED', async () => {
      const res = await request(app)
        .put('/api/suppliers/enquiry/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdEnquiryId, status: 'CLOSED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('should reject invalid transition from CLOSED', async () => {
      const res = await request(app)
        .put('/api/suppliers/enquiry/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdEnquiryId, status: 'DRAFT' });

      expect([400, 422]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Enquiry list and detail
  // ══════════════════════════════════════════════════════════════════════════

  describe('Enquiry list and detail', () => {
    it('should return paginated enquiries (data=array, meta=pagination)', async () => {
      const res = await request(app)
        .get('/api/suppliers/enquiry/list')
        .set('Cookie', purchaseCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('page');
    });

    it('should return enquiry by ID', async () => {
      const res = await request(app)
        .get(`/api/suppliers/enquiry/${createdEnquiryId}`)
        .set('Cookie', purchaseCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdEnquiryId);
    });

    it('should return 404 for non-existent enquiry', async () => {
      const res = await request(app)
        .get('/api/suppliers/enquiry/nonexistent-id')
        .set('Cookie', purchaseCookie);

      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Quotation Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  describe('Quotation Lifecycle', () => {
    it('should add a quotation with RECEIVED status', async () => {
      const res = await request(app)
        .post('/api/suppliers/quotation/add')
        .set('Cookie', purchaseCookie)
        .send({
          supplierId: 'sup-allied-metals',
          items: [{ materialId, quantity: 50, unitPrice: 200, unit: 'kg' }],
          leadTimeDays: 14,
          validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
          remarks: `Integration quotation ${uniqueId()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('RECEIVED');
      expect(res.body.data.totalAmount).toBe(10000);
      createdQuotationId = res.body.data.id;
    });

    it('should transition RECEIVED → UNDER_REVIEW', async () => {
      const res = await request(app)
        .put('/api/suppliers/quotation/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdQuotationId, status: 'UNDER_REVIEW' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UNDER_REVIEW');
    });

    it('should transition UNDER_REVIEW → APPROVED', async () => {
      const res = await request(app)
        .put('/api/suppliers/quotation/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdQuotationId, status: 'APPROVED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('should reject transition from APPROVED (terminal)', async () => {
      const res = await request(app)
        .put('/api/suppliers/quotation/update-status')
        .set('Cookie', purchaseCookie)
        .send({ id: createdQuotationId, status: 'REJECTED' });

      expect([400, 422]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Quotation list
  // ══════════════════════════════════════════════════════════════════════════

  describe('Quotation list', () => {
    it('should return paginated quotations', async () => {
      const res = await request(app)
        .get('/api/suppliers/quotation/list')
        .set('Cookie', purchaseCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('total');
    });
  });
});
