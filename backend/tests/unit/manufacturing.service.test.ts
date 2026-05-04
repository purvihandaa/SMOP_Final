import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../src/config/database', () => ({
  default: {
    manufacturingProcess: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    bOM: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    inventory: { groupBy: vi.fn() },
    scenarioRun: { create: vi.fn() },
    productionOrder: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('../../src/utils/auditLogger', () => ({ writeAuditLog: vi.fn() }));

import prisma from '../../src/config/database';
import { writeAuditLog } from '../../src/utils/auditLogger';
import { ManufacturingService } from '../../src/modules/manufacturing/manufacturing.service';
import { NotFoundError } from '../../src/utils/errors';

const service = new ManufacturingService();
const userId = 'user-001';

function makeBOMItem(materialId: string, quantity: number) {
  return {
    materialId, quantity, unit: 'pcs', remarks: null,
    material: { id: materialId, name: `Mat-${materialId}`, code: `M-${materialId}`, unit: 'pcs' },
  };
}

function makeBOM(id: string, productName: string, items: any[]) {
  return { id, productName, version: 1, status: 'ACTIVE', name: `BOM-${id}`, items };
}

describe('ManufacturingService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── createProcess ──────────────────────────────────────────────────────
  describe('createProcess', () => {
    it('should create process and write audit log', async () => {
      const input = { name: 'Welding', description: 'Arc welding', steps: [], estimatedTime: 120 };
      vi.mocked(prisma.manufacturingProcess.create).mockResolvedValue({ id: 'proc-1', ...input } as any);
      const result = await service.createProcess(input, userId);
      expect(result.id).toBe('proc-1');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE_PROCESS' }));
    });

    it('should default steps to empty array when not provided', async () => {
      vi.mocked(prisma.manufacturingProcess.create).mockResolvedValue({ id: 'proc-2' } as any);
      await service.createProcess({ name: 'Cutting' } as any, userId);
      expect(prisma.manufacturingProcess.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ steps: [] }),
      });
    });
  });

  // ── createBOM — Version Auto-Increment ─────────────────────────────────
  describe('createBOM', () => {
    const input = { name: 'Motor BOM', productName: 'Motor 500W', items: [{ materialId: 'm1', quantity: 5 }] };

    it('should set version=1 for first BOM of a product', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([]);
      vi.mocked(prisma.bOM.create).mockResolvedValue({ id: 'b1', version: 1 } as any);
      await service.createBOM(input, userId);
      expect(prisma.bOM.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 1 }) }));
    });

    it('should auto-increment version (v3 → v4)', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([{ version: 3 }] as any);
      vi.mocked(prisma.bOM.create).mockResolvedValue({ id: 'b2', version: 4 } as any);
      await service.createBOM(input, userId);
      expect(prisma.bOM.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }));
    });

    it('should default item unit to "pcs"', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([]);
      vi.mocked(prisma.bOM.create).mockResolvedValue({ id: 'b3' } as any);
      await service.createBOM({ ...input, items: [{ materialId: 'm1', quantity: 5 }] } as any, userId);
      expect(prisma.bOM.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ items: { create: [expect.objectContaining({ unit: 'pcs' })] } }),
      }));
    });

    it('should write audit log with metadata', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([]);
      vi.mocked(prisma.bOM.create).mockResolvedValue({ id: 'b4', version: 1 } as any);
      await service.createBOM(input, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_BOM', metadata: expect.objectContaining({ version: 1, itemCount: 1 }),
      }));
    });
  });

  // ── viewBOMs ───────────────────────────────────────────────────────────
  describe('viewBOMs', () => {
    it('should pass empty where when no filters', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([]);
      await service.viewBOMs();
      expect(prisma.bOM.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('should filter by productName case-insensitively', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([]);
      await service.viewBOMs({ productName: 'motor' });
      expect(prisma.bOM.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { productName: { contains: 'motor', mode: 'insensitive' } },
      }));
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([]);
      await service.viewBOMs({ status: 'ACTIVE' });
      expect(prisma.bOM.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE' } }));
    });
  });

  // ── analyzeFeasibility ─────────────────────────────────────────────────
  describe('analyzeFeasibility', () => {
    it('should throw NotFoundError when BOM missing', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(null);
      await expect(service.analyzeFeasibility({ bomId: 'x', quantity: 10 }, userId)).rejects.toThrow(/not found/i);
    });

    it('should return feasible=true when all materials sufficient', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b1', 'Motor', [makeBOMItem('a', 2), makeBOMItem('b', 5)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'a', _sum: { availableQty: 100 } },
        { materialId: 'b', _sum: { availableQty: 200 } },
      ] as any);
      const r = await service.analyzeFeasibility({ bomId: 'b1', quantity: 10 }, userId);
      expect(r.feasible).toBe(true);
      expect(r.maxProducibleQuantity).toBe(40); // min(100/2=50, 200/5=40)
      expect(r.materials.every(m => m.shortage === 0)).toBe(true);
    });

    it('should return feasible=false when one material is insufficient', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b2', 'Motor', [makeBOMItem('a', 10)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'a', _sum: { availableQty: 30 } },
      ] as any);
      const r = await service.analyzeFeasibility({ bomId: 'b2', quantity: 5 }, userId);
      expect(r.feasible).toBe(false);
      expect(r.materials[0].shortage).toBe(20); // 50-30
    });

    it('should handle zero inventory (BVA: boundary=0)', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b3', 'Motor', [makeBOMItem('a', 5)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([] as any);
      const r = await service.analyzeFeasibility({ bomId: 'b3', quantity: 1 }, userId);
      expect(r.feasible).toBe(false);
      expect(r.maxProducibleQuantity).toBe(0);
      expect(r.materials[0].shortage).toBe(5);
    });

    it('should calculate maxProducible as bottleneck material', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b4', 'M', [
        makeBOMItem('a', 4), makeBOMItem('b', 3), makeBOMItem('c', 1),
      ]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'a', _sum: { availableQty: 100 } },
        { materialId: 'b', _sum: { availableQty: 9 } },
        { materialId: 'c', _sum: { availableQty: 50 } },
      ] as any);
      const r = await service.analyzeFeasibility({ bomId: 'b4', quantity: 1 }, userId);
      expect(r.maxProducibleQuantity).toBe(3); // min(25, 3, 50)
    });

    it('should handle bomItem.quantity=0 (skip division, maxProducible=0)', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b5', 'M', [makeBOMItem('a', 0)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([] as any);
      const r = await service.analyzeFeasibility({ bomId: 'b5', quantity: 10 }, userId);
      expect(r.maxProducibleQuantity).toBe(0);
      expect(r.feasible).toBe(true);
    });

    it('should handle null availableQty as 0', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b6', 'M', [makeBOMItem('a', 1)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([{ materialId: 'a', _sum: { availableQty: null } }] as any);
      const r = await service.analyzeFeasibility({ bomId: 'b6', quantity: 1 }, userId);
      expect(r.materials[0].availableQty).toBe(0);
      expect(r.feasible).toBe(false);
    });

    it('should write audit log with feasibility metadata', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('b7', 'M', [makeBOMItem('a', 1)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([{ materialId: 'a', _sum: { availableQty: 100 } }] as any);
      await service.analyzeFeasibility({ bomId: 'b7', quantity: 5 }, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'FEASIBILITY_ANALYSIS', metadata: expect.objectContaining({ feasible: true }),
      }));
    });
  });

  // ── runScenario ────────────────────────────────────────────────────────
  describe('runScenario', () => {
    it('should throw NotFoundError when BOM missing', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(null);
      await expect(service.runScenario({ bomId: 'x', quantities: [10] }, userId)).rejects.toThrow(/not found/i);
    });

    it('should return results for each requested quantity', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('s1', 'M', [makeBOMItem('a', 2)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([{ materialId: 'a', _sum: { availableQty: 50 } }] as any);
      vi.mocked(prisma.scenarioRun.create).mockResolvedValue({ id: 'sc' } as any);
      const r = await service.runScenario({ bomId: 's1', quantities: [10, 20, 30] }, userId);
      expect(r).toHaveLength(3);
      expect(r.map(x => x.requestedQuantity)).toEqual([10, 20, 30]);
    });

    it('should mark scenarios independently feasible/infeasible', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('s2', 'M', [makeBOMItem('a', 5)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([{ materialId: 'a', _sum: { availableQty: 30 } }] as any);
      vi.mocked(prisma.scenarioRun.create).mockResolvedValue({ id: 'sc' } as any);
      const r = await service.runScenario({ bomId: 's2', quantities: [5, 6, 7] }, userId);
      expect(r[0].feasible).toBe(true);  // 25 ≤ 30
      expect(r[1].feasible).toBe(true);  // 30 ≤ 30
      expect(r[2].feasible).toBe(false); // 35 > 30
    });

    it('should calculate inventory impact correctly', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('s3', 'M', [makeBOMItem('a', 4)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([{ materialId: 'a', _sum: { availableQty: 100 } }] as any);
      vi.mocked(prisma.scenarioRun.create).mockResolvedValue({ id: 'sc' } as any);
      const r = await service.runScenario({ bomId: 's3', quantities: [10] }, userId);
      expect(r[0].inventoryImpact![0]).toEqual(expect.objectContaining({ currentQty: 100, requiredQty: 40, remainingQty: 60 }));
    });

    it('should persist each scenario run', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue(makeBOM('s4', 'M', [makeBOMItem('a', 1)]) as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([{ materialId: 'a', _sum: { availableQty: 10 } }] as any);
      vi.mocked(prisma.scenarioRun.create).mockResolvedValue({ id: 'sc' } as any);
      await service.runScenario({ bomId: 's4', quantities: [3, 5] }, userId);
      expect(prisma.scenarioRun.create).toHaveBeenCalledTimes(2);
    });
  });

  // ── getWorkerInstructions ──────────────────────────────────────────────
  describe('getWorkerInstructions', () => {
    it('should return process instructions for processId filter', async () => {
      vi.mocked(prisma.manufacturingProcess.findUnique).mockResolvedValue({ id: 'p1', name: 'Weld', description: 'W', estimatedTime: 60, steps: [] } as any);
      const r = await service.getWorkerInstructions({ processId: 'p1' });
      expect(r.process.name).toBe('Weld');
    });

    it('should return BOM instructions for bomId filter', async () => {
      vi.mocked(prisma.bOM.findUnique).mockResolvedValue({
        productName: 'Motor', version: 2,
        items: [{ material: { name: 'Copper', code: 'CW', unit: 'kg' }, quantity: 10, unit: 'kg', remarks: null }],
      } as any);
      const r = await service.getWorkerInstructions({ bomId: 'b1' });
      expect(r.bom.productName).toBe('Motor');
      expect(r.bom.materials[0].material).toBe('Copper');
    });

    it('should return overview when no filters', async () => {
      vi.mocked(prisma.manufacturingProcess.findMany).mockResolvedValue([{ id: 'p1' }] as any);
      vi.mocked(prisma.bOM.findMany).mockResolvedValue([{ id: 'b1' }] as any);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([{ id: 'o1' }] as any);
      const r = await service.getWorkerInstructions();
      expect(r.processes).toHaveLength(1);
      expect(r.boms).toHaveLength(1);
      expect(r.activeOrders).toHaveLength(1);
    });

    it('should return empty for unknown processId', async () => {
      vi.mocked(prisma.manufacturingProcess.findUnique).mockResolvedValue(null);
      const r = await service.getWorkerInstructions({ processId: 'nope' });
      expect(r.process).toBeUndefined();
    });
  });
});
