import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockTx = {
  purchaseOrder: { findUnique: vi.fn(), update: vi.fn() },
  purchaseOrderItem: { update: vi.fn() },
  materialBatch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  materialReceipt: { create: vi.fn(), update: vi.fn() },
  materialReceiptItem: { findFirst: vi.fn() },
  materialInspection: { create: vi.fn() },
  storageLocation: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  inventory: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  inventoryTransaction: { create: vi.fn() },
};

vi.mock('../../src/config/database', () => ({
  default: {
    $transaction: vi.fn((cb: any) => cb(mockTx)),
    materialBatch: { create: vi.fn() },
    inventory: { findMany: vi.fn(), count: vi.fn() },
    storageLocation: { findMany: vi.fn() },
    material: { findMany: vi.fn() },
    materialReceipt: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock('../../src/utils/auditLogger', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../../src/utils/sequence', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('SEQ-001') }));

import prisma from '../../src/config/database';
import { writeAuditLog } from '../../src/utils/auditLogger';
import { MaterialsService } from '../../src/modules/materials/materials.service';
import { NotFoundError, AppError } from '../../src/utils/errors';

const service = new MaterialsService();
const userId = 'user-001';

describe('MaterialsService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // recordReceipt
  // ════════════════════════════════════════════════════════════════════════

  describe('recordReceipt', () => {
    const validInput = {
      purchaseOrderId: 'po-1',
      items: [{ materialId: 'mat-1', quantity: 10 }],
      remarks: 'Test receipt',
    };

    it('should throw NotFoundError when PO does not exist', async () => {
      mockTx.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.recordReceipt(validInput, userId)).rejects.toThrow(/not found/i);
    });

    // ECP: Receivable statuses
    it.each(['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_DELIVERED'])(
      'should accept PO in %s status',
      async (status) => {
        mockTx.purchaseOrder.findUnique
          .mockResolvedValueOnce({ id: 'po-1', status, supplierId: 's1', poNumber: 'PO-001', items: [{ id: 'pi-1', materialId: 'mat-1', quantity: 10, receivedQty: 0 }] })
          .mockResolvedValueOnce({ id: 'po-1', status, items: [{ id: 'pi-1', materialId: 'mat-1', quantity: 10, receivedQty: 10 }] });
        mockTx.materialBatch.create.mockResolvedValue({ id: 'batch-1' });
        mockTx.materialReceipt.create.mockResolvedValue({ id: 'rec-1', receiptNo: 'SEQ-001' });
        mockTx.purchaseOrder.update.mockResolvedValue({});

        await expect(service.recordReceipt(validInput, userId)).resolves.toBeDefined();
      },
    );

    // ECP: Non-receivable statuses
    it.each(['DRAFT', 'DELIVERED', 'CLOSED', 'CANCELLED'])(
      'should reject PO in %s status',
      async (status) => {
        mockTx.purchaseOrder.findUnique.mockResolvedValue({
          id: 'po-1', status, supplierId: 's1', poNumber: 'PO-001', items: [],
        });
        await expect(service.recordReceipt(validInput, userId)).rejects.toThrow(AppError);
      },
    );

    it('should set PO to DELIVERED when all items fully received', async () => {
      mockTx.purchaseOrder.findUnique
        .mockResolvedValueOnce({ id: 'po-1', status: 'APPROVED', supplierId: 's1', poNumber: 'PO-001', items: [{ id: 'pi-1', materialId: 'mat-1', quantity: 10, receivedQty: 0 }] })
        .mockResolvedValueOnce({ id: 'po-1', status: 'APPROVED', items: [{ id: 'pi-1', materialId: 'mat-1', quantity: 10, receivedQty: 10 }] });
      mockTx.materialBatch.create.mockResolvedValue({ id: 'batch-1' });
      mockTx.materialReceipt.create.mockResolvedValue({ id: 'rec-1' });
      mockTx.purchaseOrder.update.mockResolvedValue({});

      await service.recordReceipt(validInput, userId);

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED' }) }),
      );
    });

    it('should set PO to PARTIALLY_DELIVERED when some but not all items received', async () => {
      mockTx.purchaseOrder.findUnique
        .mockResolvedValueOnce({ id: 'po-1', status: 'APPROVED', supplierId: 's1', poNumber: 'PO-001', items: [{ id: 'pi-1', materialId: 'mat-1', quantity: 100, receivedQty: 0 }] })
        .mockResolvedValueOnce({ id: 'po-1', status: 'APPROVED', items: [{ id: 'pi-1', materialId: 'mat-1', quantity: 100, receivedQty: 10 }] });
      mockTx.materialBatch.create.mockResolvedValue({ id: 'batch-1' });
      mockTx.materialReceipt.create.mockResolvedValue({ id: 'rec-1' });
      mockTx.purchaseOrder.update.mockResolvedValue({});

      await service.recordReceipt(validInput, userId);

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_DELIVERED' }) }),
      );
    });

    it('should write audit log on success', async () => {
      mockTx.purchaseOrder.findUnique
        .mockResolvedValueOnce({ id: 'po-1', status: 'APPROVED', supplierId: 's1', poNumber: 'PO-001', items: [] })
        .mockResolvedValueOnce({ id: 'po-1', items: [] });
      mockTx.materialReceipt.create.mockResolvedValue({ id: 'rec-1' });

      await service.recordReceipt({ purchaseOrderId: 'po-1', items: [] } as any, userId);

      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'RECORD_RECEIPT' }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // recordInspection
  // ════════════════════════════════════════════════════════════════════════

  describe('recordInspection', () => {
    const baseInput = { batchId: 'batch-1', result: 'ACCEPTED' as const, inspectedQty: 10, acceptedQty: 8, rejectedQty: 2 };

    it('should throw NotFoundError when batch missing', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue(null);
      await expect(service.recordInspection(baseInput, userId)).rejects.toThrow(/not found/i);
    });

    it('should throw AppError when accepted+rejected > inspected (BVA: boundary violation)', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: { id: 'm1' } });
      const badInput = { ...baseInput, inspectedQty: 10, acceptedQty: 6, rejectedQty: 5 }; // 6+5=11 > 10
      await expect(service.recordInspection(badInput, userId)).rejects.toThrow('cannot exceed');
    });

    it('should accept when accepted+rejected == inspected (BVA: exact boundary)', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: { id: 'm1' } });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1', name: 'Default Warehouse' });
      mockTx.inventory.findUnique.mockResolvedValue(null);
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-1' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue({ receiptId: 'rec-1' });
      mockTx.materialReceipt.update.mockResolvedValue({});

      const exactInput = { ...baseInput, inspectedQty: 10, acceptedQty: 7, rejectedQty: 3 }; // 7+3=10 == 10
      await expect(service.recordInspection(exactInput, userId)).resolves.toBeDefined();
    });

    it('should accept when accepted+rejected < inspected (BVA: below boundary)', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: { id: 'm1' } });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      mockTx.inventory.findUnique.mockResolvedValue(null);
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-1' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue(null);

      const lessInput = { ...baseInput, inspectedQty: 10, acceptedQty: 3, rejectedQty: 2 }; // 5 < 10
      await expect(service.recordInspection(lessInput, userId)).resolves.toBeDefined();
    });

    it('should create new inventory when none exists at default location', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: {} });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      mockTx.inventory.findUnique.mockResolvedValue(null); // no existing inventory
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-new' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue(null);

      await service.recordInspection({ ...baseInput, acceptedQty: 8, rejectedQty: 2 }, userId);

      expect(mockTx.inventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ materialId: 'm1', quantity: 8, availableQty: 8 }),
      });
    });

    it('should update existing inventory when it exists', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: {} });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-existing', quantity: 50, availableQty: 45 });
      mockTx.inventory.update.mockResolvedValue({});
      mockTx.inventoryTransaction.create.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue(null);

      await service.recordInspection({ ...baseInput, acceptedQty: 8, rejectedQty: 2 }, userId);

      expect(mockTx.inventory.update).toHaveBeenCalledWith({
        where: { id: 'inv-existing' },
        data: { quantity: 58, availableQty: 53 },
      });
    });

    it('should skip inventory creation when acceptedQty=0 (BVA: zero boundary)', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: {} });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue(null);

      await service.recordInspection({ ...baseInput, acceptedQty: 0, rejectedQty: 10, inspectedQty: 10 }, userId);

      expect(mockTx.inventory.create).not.toHaveBeenCalled();
      expect(mockTx.inventory.update).not.toHaveBeenCalled();
    });

    it('should create default warehouse if none exists', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: {} });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.storageLocation.findFirst.mockResolvedValue(null); // no default warehouse
      mockTx.storageLocation.create.mockResolvedValue({ id: 'new-loc', name: 'Default Warehouse' });
      mockTx.inventory.findUnique.mockResolvedValue(null);
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-1' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue(null);

      await service.recordInspection(baseInput, userId);

      expect(mockTx.storageLocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Default Warehouse' }),
      });
    });

    it('should write audit log on success', async () => {
      mockTx.materialBatch.findUnique.mockResolvedValue({ id: 'batch-1', materialId: 'm1', batchNumber: 'B001', material: {} });
      mockTx.materialInspection.create.mockResolvedValue({ id: 'ins-1' });
      mockTx.materialBatch.update.mockResolvedValue({});
      mockTx.storageLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      mockTx.inventory.findUnique.mockResolvedValue(null);
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-1' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});
      mockTx.materialReceiptItem.findFirst.mockResolvedValue(null);

      await service.recordInspection(baseInput, userId);

      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'RECORD_INSPECTION',
        metadata: expect.objectContaining({ acceptedQty: 8, rejectedQty: 2 }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // updateLocation
  // ════════════════════════════════════════════════════════════════════════

  describe('updateLocation', () => {
    const input = { inventoryId: 'inv-1', newLocationId: 'loc-2', quantity: 10 };

    it('should throw NotFoundError when inventory missing', async () => {
      mockTx.inventory.findUnique.mockResolvedValue(null);
      await expect(service.updateLocation(input, userId)).rejects.toThrow(/not found/i);
    });

    it('should throw AppError when move quantity > available (BVA: exceed)', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-1', availableQty: 5, quantity: 10, materialId: 'm1', material: { name: 'M1' }, location: { name: 'L1' } });
      await expect(service.updateLocation({ ...input, quantity: 6 }, userId)).rejects.toThrow(AppError);
    });

    it('should allow move when quantity == availableQty (BVA: exact boundary)', async () => {
      mockTx.inventory.findUnique
        .mockResolvedValueOnce({ id: 'inv-1', availableQty: 10, quantity: 10, materialId: 'm1', material: { name: 'M1' }, location: { name: 'L1' } })
        .mockResolvedValueOnce(null); // no dest inventory
      mockTx.storageLocation.findUnique.mockResolvedValue({ id: 'loc-2', name: 'L2' });
      mockTx.inventory.update.mockResolvedValue({});
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-dest' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});

      const result = await service.updateLocation({ ...input, quantity: 10 }, userId);

      expect(result.movedQuantity).toBe(10);
    });

    it('should throw NotFoundError when destination location missing', async () => {
      mockTx.inventory.findUnique.mockResolvedValue({ id: 'inv-1', availableQty: 10, quantity: 10, materialId: 'm1', material: { name: 'M1' }, location: { name: 'L1' } });
      mockTx.storageLocation.findUnique.mockResolvedValue(null);
      await expect(service.updateLocation(input, userId)).rejects.toThrow(/not found/i);
    });

    it('should create new destination inventory when none exists', async () => {
      mockTx.inventory.findUnique
        .mockResolvedValueOnce({ id: 'inv-1', availableQty: 20, quantity: 20, materialId: 'm1', material: { name: 'M1' }, location: { name: 'L1' } })
        .mockResolvedValueOnce(null); // no dest
      mockTx.storageLocation.findUnique.mockResolvedValue({ id: 'loc-2', name: 'L2' });
      mockTx.inventory.update.mockResolvedValue({});
      mockTx.inventory.create.mockResolvedValue({ id: 'inv-new' });
      mockTx.inventoryTransaction.create.mockResolvedValue({});

      await service.updateLocation(input, userId);

      expect(mockTx.inventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ materialId: 'm1', locationId: 'loc-2', quantity: 10, availableQty: 10 }),
      });
    });

    it('should update existing destination inventory', async () => {
      mockTx.inventory.findUnique
        .mockResolvedValueOnce({ id: 'inv-1', availableQty: 20, quantity: 20, materialId: 'm1', material: { name: 'M1' }, location: { name: 'L1' } })
        .mockResolvedValueOnce({ id: 'inv-dest', quantity: 30, availableQty: 25 }); // dest exists
      mockTx.storageLocation.findUnique.mockResolvedValue({ id: 'loc-2', name: 'L2' });
      mockTx.inventory.update.mockResolvedValue({});
      mockTx.inventoryTransaction.create.mockResolvedValue({});

      await service.updateLocation(input, userId);

      // Source: 20-10=10
      expect(mockTx.inventory.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inv-1' }, data: { quantity: 10, availableQty: 10 },
      }));
      // Dest: 30+10=40
      expect(mockTx.inventory.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inv-dest' }, data: { quantity: 40, availableQty: 35 },
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // viewInventory
  // ════════════════════════════════════════════════════════════════════════

  describe('viewInventory', () => {
    it('should apply search filter with OR condition', async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventory.count).mockResolvedValue(0);

      await service.viewInventory({ page: 1, limit: 20, skip: 0 }, { search: 'copper' });

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { material: expect.objectContaining({ OR: expect.any(Array) }) },
      }));
    });

    it('should apply type filter', async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventory.count).mockResolvedValue(0);

      await service.viewInventory({ page: 1, limit: 20, skip: 0 }, { type: 'RAW_MATERIAL' });

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { material: { type: 'RAW_MATERIAL' } },
      }));
    });

    it('should return items and total', async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([{ id: 'inv-1' }] as any);
      vi.mocked(prisma.inventory.count).mockResolvedValue(1);

      const result = await service.viewInventory({ page: 1, limit: 20, skip: 0 }, {});

      expect(result).toEqual({ items: [{ id: 'inv-1' }], total: 1 });
    });
  });
});
