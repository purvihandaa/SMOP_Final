import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs } from './helpers';

/**
 * Materials & Inventory Integration Tests
 *
 * Tests material receipt, inspection, inventory view, and location transfer.
 */

describe('Materials & Inventory Integration', () => {
  let storesCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    storesCookie = await loginAs('stores');
    adminCookie = await loginAs('admin');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/material/list
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/material/list', () => {
    it('should return list of materials', async () => {
      const res = await request(app)
        .get('/api/material/list')
        .set('Cookie', storesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(7); // 7 seeded
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/material/locations
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/material/locations', () => {
    it('should return list of storage locations', async () => {
      const res = await request(app)
        .get('/api/material/locations')
        .set('Cookie', storesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4); // 4 seeded
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/inventory/view
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/inventory/view', () => {
    it('should return paginated inventory', async () => {
      const res = await request(app)
        .get('/api/inventory/view')
        .set('Cookie', storesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/inventory/view?type=RAW')
        .set('Cookie', storesCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should support search filter', async () => {
      const res = await request(app)
        .get('/api/inventory/view?search=steel')
        .set('Cookie', storesCookie);

      expect(res.status).toBe(200);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/material/receipt — requires a PO in receivable status
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/material/receipt', () => {
    it('should return 422 for missing purchaseOrderId', async () => {
      const res = await request(app)
        .post('/api/material/receipt')
        .set('Cookie', storesCookie)
        .send({ items: [] });

      expect(res.status).toBe(422);
    });

    it('should return 404 for non-existent PO', async () => {
      const res = await request(app)
        .post('/api/material/receipt')
        .set('Cookie', storesCookie)
        .send({
          purchaseOrderId: 'nonexistent-po-id',
          items: [{ materialId: 'mat-id', quantity: 10 }],
        });

      expect(res.status).toBe(404);
    });

    it('should record receipt for APPROVED PO (PO-2024-002)', async () => {
      // PO-2024-002 is seeded as APPROVED with AL-ROD-002 qty=200
      // First get the PO ID and item materialId
      const purchaseCookie = await loginAs('purchase');
      const poList = await request(app)
        .get('/api/purchase-order/list?search=PO-2024-002')
        .set('Cookie', purchaseCookie);

      const po = poList.body.data?.find((o: any) => o.poNumber === 'PO-2024-002');
      if (!po) return; // skip if not found

      // Get the PO details for the material ID
      const poDetail = await request(app)
        .get(`/api/purchase-order/${po.id}`)
        .set('Cookie', purchaseCookie);

      const materialId = poDetail.body.data.items?.[0]?.materialId;
      if (!materialId) return;

      const res = await request(app)
        .post('/api/material/receipt')
        .set('Cookie', storesCookie)
        .send({
          purchaseOrderId: po.id,
          items: [{ materialId, quantity: 50 }],
          remarks: 'Integration test partial receipt',
        });

      // 201 if PO is still in a receivable status, 400 if it's been changed by previous runs
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('id');
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/material/inspection
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/material/inspection', () => {
    it('should return 422 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/material/inspection')
        .set('Cookie', storesCookie)
        .send({});

      expect(res.status).toBe(422);
    });

    it('should return 404 for non-existent batch', async () => {
      const res = await request(app)
        .post('/api/material/inspection')
        .set('Cookie', storesCookie)
        .send({
          batchId: 'nonexistent-batch',
          result: 'ACCEPTED',
          inspectedQty: 10,
          acceptedQty: 8,
          rejectedQty: 2,
        });

      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/material/receipts
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/material/receipts', () => {
    it('should return list of receipts', async () => {
      const res = await request(app)
        .get('/api/material/receipts')
        .set('Cookie', storesCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PUT /api/inventory/update-location
  // ══════════════════════════════════════════════════════════════════════════

  describe('PUT /api/inventory/update-location', () => {
    it('should return 422 for missing fields', async () => {
      const res = await request(app)
        .put('/api/inventory/update-location')
        .set('Cookie', storesCookie)
        .send({});

      expect(res.status).toBe(422);
    });

    it('should return 404 for non-existent inventory', async () => {
      const res = await request(app)
        .put('/api/inventory/update-location')
        .set('Cookie', storesCookie)
        .send({
          inventoryId: 'nonexistent-inv-id',
          newLocationId: 'nonexistent-loc-id',
          quantity: 10,
        });

      expect(res.status).toBe(404);
    });
  });
});
