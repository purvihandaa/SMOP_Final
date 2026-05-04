import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, UserKey } from './helpers';

/**
 * RBAC Integration Tests
 *
 * Verifies that role-based access control is enforced correctly across
 * all major endpoints. Each test confirms that unauthorized roles receive 403
 * and authorized roles receive 200/201 (or a valid business-logic error, not 403).
 */

describe('RBAC Integration', () => {
  const cookies: Record<UserKey, string> = {} as any;

  beforeAll(async () => {
    // Login as every seeded user and cache cookies
    const keys: UserKey[] = ['admin', 'purchase', 'stores', 'manufacturing', 'worker', 'sales', 'management'];
    for (const key of keys) {
      cookies[key] = await loginAs(key);
    }
  });

  // Helper: test that a role gets 403 on an endpoint
  function expectForbidden(method: 'get' | 'post' | 'put', path: string, role: UserKey, body?: any) {
    it(`should return 403 for ${role} on ${method.toUpperCase()} ${path}`, async () => {
      const req = request(app)[method](path).set('Cookie', cookies[role]);
      if (body) req.send(body);
      const res = await req;
      expect(res.status).toBe(403);
    });
  }

  // Helper: test that a role does NOT get 403 (gets 200, 201, 400, 404, 422 — but not 403)
  function expectAllowed(method: 'get' | 'post' | 'put', path: string, role: UserKey, body?: any) {
    it(`should NOT return 403 for ${role} on ${method.toUpperCase()} ${path}`, async () => {
      const req = request(app)[method](path).set('Cookie', cookies[role]);
      if (body) req.send(body);
      const res = await req;
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Unauthenticated access
  // ══════════════════════════════════════════════════════════════════════════

  describe('Unauthenticated requests', () => {
    it('should return 401 on protected GET without cookie', async () => {
      const res = await request(app).get('/api/purchase-order/list');
      expect(res.status).toBe(401);
    });

    it('should return 401 on protected POST without cookie', async () => {
      const res = await request(app).post('/api/purchase-order/create').send({});
      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Purchase Order routes — ADMIN + PURCHASE_HANDLER only for writes
  // ══════════════════════════════════════════════════════════════════════════

  describe('Purchase Orders RBAC', () => {
    // Reads: admin, purchase, stores, management
    expectAllowed('get', '/api/purchase-order/list', 'admin');
    expectAllowed('get', '/api/purchase-order/list', 'purchase');
    expectAllowed('get', '/api/purchase-order/list', 'stores');
    expectAllowed('get', '/api/purchase-order/list', 'management');
    expectForbidden('get', '/api/purchase-order/list', 'sales');
    expectForbidden('get', '/api/purchase-order/list', 'manufacturing');
    expectForbidden('get', '/api/purchase-order/list', 'worker');

    // Writes: admin, purchase only
    expectForbidden('post', '/api/purchase-order/create', 'stores', { supplierId: 'x', items: [] });
    expectForbidden('post', '/api/purchase-order/create', 'sales', { supplierId: 'x', items: [] });
    expectForbidden('post', '/api/purchase-order/create', 'manufacturing', { supplierId: 'x', items: [] });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Supplier routes — ADMIN + PURCHASE_HANDLER for writes
  // ══════════════════════════════════════════════════════════════════════════

  describe('Supplier RBAC', () => {
    // Supplier list: all authenticated users
    expectAllowed('get', '/api/suppliers/list', 'admin');
    expectAllowed('get', '/api/suppliers/list', 'worker');
    expectAllowed('get', '/api/suppliers/list', 'sales');

    // Enquiry writes: admin, purchase only
    expectForbidden('post', '/api/suppliers/enquiry/create', 'stores', { supplierId: 'x', items: [] });
    expectForbidden('post', '/api/suppliers/enquiry/create', 'sales', { supplierId: 'x', items: [] });
    expectForbidden('post', '/api/suppliers/enquiry/create', 'manufacturing', { supplierId: 'x', items: [] });

    // Enquiry reads: admin, purchase, management
    expectAllowed('get', '/api/suppliers/enquiry/list', 'admin');
    expectAllowed('get', '/api/suppliers/enquiry/list', 'purchase');
    expectAllowed('get', '/api/suppliers/enquiry/list', 'management');
    expectForbidden('get', '/api/suppliers/enquiry/list', 'stores');
    expectForbidden('get', '/api/suppliers/enquiry/list', 'sales');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Material routes — ADMIN + STORES_HANDLER for writes
  // ══════════════════════════════════════════════════════════════════════════

  describe('Material RBAC', () => {
    // Receipt: admin, stores only
    expectForbidden('post', '/api/material/receipt', 'purchase', { purchaseOrderId: 'x', items: [] });
    expectForbidden('post', '/api/material/receipt', 'sales', { purchaseOrderId: 'x', items: [] });
    expectForbidden('post', '/api/material/receipt', 'manufacturing', { purchaseOrderId: 'x', items: [] });

    // Inspection: admin, stores only
    expectForbidden('post', '/api/material/inspection', 'purchase', { batchId: 'x', result: 'ACCEPTED', inspectedQty: 1, acceptedQty: 1, rejectedQty: 0 });
    expectForbidden('post', '/api/material/inspection', 'sales', { batchId: 'x', result: 'ACCEPTED', inspectedQty: 1, acceptedQty: 1, rejectedQty: 0 });

    // Materials list: all authenticated (no RBAC)
    expectAllowed('get', '/api/material/list', 'worker');
    expectAllowed('get', '/api/material/list', 'sales');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Inventory routes
  // ══════════════════════════════════════════════════════════════════════════

  describe('Inventory RBAC', () => {
    // View: admin, stores, manufacturing, purchase, management
    expectAllowed('get', '/api/inventory/view', 'admin');
    expectAllowed('get', '/api/inventory/view', 'stores');
    expectAllowed('get', '/api/inventory/view', 'manufacturing');
    expectAllowed('get', '/api/inventory/view', 'purchase');
    expectAllowed('get', '/api/inventory/view', 'management');
    expectForbidden('get', '/api/inventory/view', 'sales');
    expectForbidden('get', '/api/inventory/view', 'worker');

    // Update location: admin, stores only
    expectForbidden('put', '/api/inventory/update-location', 'purchase', { inventoryId: 'x', newLocationId: 'y', quantity: 1 });
    expectForbidden('put', '/api/inventory/update-location', 'manufacturing', { inventoryId: 'x', newLocationId: 'y', quantity: 1 });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Manufacturing routes — ADMIN + MANUFACTURING roles
  // ══════════════════════════════════════════════════════════════════════════

  describe('Manufacturing RBAC', () => {
    // Process create: admin, manufacturing supervisor
    expectForbidden('post', '/api/process/create', 'purchase', { name: 'Test', steps: [] });
    expectForbidden('post', '/api/process/create', 'sales', { name: 'Test', steps: [] });
    expectForbidden('post', '/api/process/create', 'stores', { name: 'Test', steps: [] });
    expectForbidden('post', '/api/process/create', 'worker', { name: 'Test', steps: [] });

    // BOM view: admin, manufacturing supervisor, worker, management
    expectAllowed('get', '/api/bom/view', 'admin');
    expectAllowed('get', '/api/bom/view', 'manufacturing');
    expectAllowed('get', '/api/bom/view', 'worker');
    expectAllowed('get', '/api/bom/view', 'management');
    expectForbidden('get', '/api/bom/view', 'purchase');
    expectForbidden('get', '/api/bom/view', 'sales');

    // Feasibility: admin, manufacturing, management
    expectForbidden('post', '/api/feasibility/analyze', 'worker', { bomId: 'x', quantity: 1 });
    expectForbidden('post', '/api/feasibility/analyze', 'purchase', { bomId: 'x', quantity: 1 });
    expectForbidden('post', '/api/feasibility/analyze', 'sales', { bomId: 'x', quantity: 1 });

    // Worker instructions: admin, manufacturing, worker
    expectAllowed('get', '/api/worker/instructions', 'admin');
    expectAllowed('get', '/api/worker/instructions', 'manufacturing');
    expectAllowed('get', '/api/worker/instructions', 'worker');
    expectForbidden('get', '/api/worker/instructions', 'purchase');
    expectForbidden('get', '/api/worker/instructions', 'sales');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Sales routes — ADMIN + SALES_HANDLER for writes
  // ══════════════════════════════════════════════════════════════════════════

  describe('Sales RBAC', () => {
    // Customer enquiry: admin, sales
    expectForbidden('post', '/api/customer/enquiry', 'purchase', { customerName: 'X', productName: 'Y', quantity: 1 });
    expectForbidden('post', '/api/customer/enquiry', 'stores', { customerName: 'X', productName: 'Y', quantity: 1 });
    expectForbidden('post', '/api/customer/enquiry', 'manufacturing', { customerName: 'X', productName: 'Y', quantity: 1 });

    // Order list: admin, sales, management
    expectAllowed('get', '/api/order/list', 'admin');
    expectAllowed('get', '/api/order/list', 'sales');
    expectAllowed('get', '/api/order/list', 'management');
    expectForbidden('get', '/api/order/list', 'purchase');
    expectForbidden('get', '/api/order/list', 'stores');
  });
});
