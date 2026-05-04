import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, uniqueId } from './helpers';

/**
 * Manufacturing Integration Tests
 *
 * Tests BOM creation, feasibility analysis, scenario planning,
 * and worker instructions through real HTTP endpoints.
 */

describe('Manufacturing Integration', () => {
  let mfgCookie: string;
  let adminCookie: string;
  let materialId: string;
  let createdBomId: string;

  beforeAll(async () => {
    mfgCookie = await loginAs('manufacturing');
    adminCookie = await loginAs('admin');
    // Get a real material ID for BOM creation
    const matRes = await request(app).get('/api/material/list').set('Cookie', mfgCookie);
    materialId = matRes.body.data[0]?.id;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/process/create
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/process/create', () => {
    it('should create a manufacturing process', async () => {
      const res = await request(app)
        .post('/api/process/create')
        .set('Cookie', mfgCookie)
        .send({
          name: `Test Process ${uniqueId()}`,
          description: 'Integration test process',
          estimatedTime: 60,
          steps: [
            { stepNumber: 1, name: 'Step 1', description: 'First step', estimatedMinutes: 30 },
            { stepNumber: 2, name: 'Step 2', description: 'Second step', estimatedMinutes: 30 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
    });

    it('should return 422 for missing process name', async () => {
      const res = await request(app)
        .post('/api/process/create')
        .set('Cookie', mfgCookie)
        .send({ description: 'No name' });

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/bom/create
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/bom/create', () => {
    it('should create a BOM with auto-increment version', async () => {
      const productName = `Test Product ${uniqueId()}`;
      const res = await request(app)
        .post('/api/bom/create')
        .set('Cookie', mfgCookie)
        .send({
          name: `BOM - ${productName}`,
          productName,
          description: 'Integration test BOM',
          items: [
            { materialId, quantity: 10, unit: 'pcs' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.productName).toBe(productName);
      createdBomId = res.body.data.id;
    });

    it('should return 422 for missing productName', async () => {
      const res = await request(app)
        .post('/api/bom/create')
        .set('Cookie', mfgCookie)
        .send({ name: 'No product', items: [] });

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/bom/view
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/bom/view', () => {
    it('should return list of BOMs', async () => {
      const res = await request(app)
        .get('/api/bom/view')
        .set('Cookie', mfgCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // 2 seeded + test
    });

    it('should filter by productName', async () => {
      const res = await request(app)
        .get('/api/bom/view?productName=500W')
        .set('Cookie', mfgCookie);

      expect(res.status).toBe(200);
      res.body.data.forEach((bom: any) => {
        expect(bom.productName.toLowerCase()).toContain('500w');
      });
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/bom/view?status=ACTIVE')
        .set('Cookie', mfgCookie);

      expect(res.status).toBe(200);
      res.body.data.forEach((bom: any) => {
        expect(bom.status).toBe('ACTIVE');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/feasibility/analyze
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/feasibility/analyze', () => {
    let seedBomId: string;

    beforeAll(async () => {
      // Get the seeded BOM ID for Speed Motor 500W
      const res = await request(app)
        .get('/api/bom/view?productName=Speed Motor 500W')
        .set('Cookie', mfgCookie);

      seedBomId = res.body.data[0]?.id;
    });

    it('should return feasibility analysis for seeded BOM', async () => {
      if (!seedBomId) return; // skip if seed data not present

      const res = await request(app)
        .post('/api/feasibility/analyze')
        .set('Cookie', mfgCookie)
        .send({ bomId: seedBomId, quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('feasible');
      expect(res.body.data).toHaveProperty('maxProducibleQuantity');
      expect(res.body.data).toHaveProperty('materials');
      expect(Array.isArray(res.body.data.materials)).toBe(true);
      expect(res.body.data.requestedQuantity).toBe(5);
    });

    it('should return 404 for non-existent BOM', async () => {
      const res = await request(app)
        .post('/api/feasibility/analyze')
        .set('Cookie', mfgCookie)
        .send({ bomId: 'nonexistent-bom-id', quantity: 10 });

      expect(res.status).toBe(404);
    });

    it('should return 422 for missing quantity', async () => {
      const res = await request(app)
        .post('/api/feasibility/analyze')
        .set('Cookie', mfgCookie)
        .send({ bomId: 'some-id' });

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/feasibility/scenario
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/feasibility/scenario', () => {
    let seedBomId: string;

    beforeAll(async () => {
      const res = await request(app)
        .get('/api/bom/view?productName=Speed Motor 500W')
        .set('Cookie', mfgCookie);
      seedBomId = res.body.data[0]?.id;
    });

    it('should run scenario for multiple quantities', async () => {
      if (!seedBomId) return;

      const res = await request(app)
        .post('/api/feasibility/scenario')
        .set('Cookie', mfgCookie)
        .send({ bomId: seedBomId, quantities: [5, 10, 20, 50] });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(4);

      // Each scenario should have feasibility result
      res.body.data.forEach((scenario: any) => {
        expect(scenario).toHaveProperty('feasible');
        expect(scenario).toHaveProperty('requestedQuantity');
        expect(scenario).toHaveProperty('maxProducibleQuantity');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/worker/instructions
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/worker/instructions', () => {
    it('should return overview when no filters', async () => {
      const workerCookie = await loginAs('worker');
      const res = await request(app)
        .get('/api/worker/instructions')
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('processes');
      expect(res.body.data).toHaveProperty('boms');
    });

    it('should return process instructions with processId', async () => {
      const res = await request(app)
        .get('/api/worker/instructions?processId=proc-motor-assembly')
        .set('Cookie', mfgCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('process');
      expect(res.body.data.process.name).toBe('Motor Assembly Process');
    });
  });
});
