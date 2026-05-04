import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../src/config/database', () => ({
  default: {
    customerEnquiry: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    customerQuotation: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    customerOrder: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    bOM: { findFirst: vi.fn() },
    inventory: { groupBy: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    inventoryTransaction: { create: vi.fn() },
  },
}));
vi.mock('../../src/utils/auditLogger', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../../src/utils/sequence', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('SEQ-001') }));

import prisma from '../../src/config/database';
import { writeAuditLog } from '../../src/utils/auditLogger';
import { SalesService } from '../../src/modules/sales/sales.service';
import { AppError } from '../../src/utils/errors';

const service = new SalesService();
const userId = 'user-001';

describe('SalesService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // createCustomerEnquiry
  // ════════════════════════════════════════════════════════════════════════

  describe('createCustomerEnquiry', () => {
    const input = { customerName: 'Acme Corp', productName: 'Motor 500W', quantity: 50 };

    it('should create enquiry with NEW status', async () => {
      vi.mocked(prisma.customerEnquiry.create).mockResolvedValue({ id: 'ce-1', status: 'NEW' } as any);
      await service.createCustomerEnquiry(input, userId);
      expect(prisma.customerEnquiry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'NEW', customerName: 'Acme Corp' }),
      }));
    });

    it('should handle optional email/phone as null', async () => {
      vi.mocked(prisma.customerEnquiry.create).mockResolvedValue({ id: 'ce-1' } as any);
      await service.createCustomerEnquiry(input, userId);
      expect(prisma.customerEnquiry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ customerEmail: null, customerPhone: null }),
      }));
    });

    it('should write audit log', async () => {
      vi.mocked(prisma.customerEnquiry.create).mockResolvedValue({ id: 'ce-1' } as any);
      await service.createCustomerEnquiry(input, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_CUSTOMER_ENQUIRY',
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // generateQuotation
  // ════════════════════════════════════════════════════════════════════════

  describe('generateQuotation', () => {
    const input = { customerName: 'Acme', productName: 'Motor', quantity: 10, unitPrice: 500 };

    it('should calculate totalAmount = quantity × unitPrice', async () => {
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-1' } as any);
      await service.generateQuotation(input, userId);
      expect(prisma.customerQuotation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 5000, status: 'DRAFT' }),
      }));
    });

    it('should set version=1 when no enquiryId', async () => {
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-1' } as any);
      await service.generateQuotation(input, userId);
      expect(prisma.customerQuotation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ version: 1 }),
      }));
    });

    it('should auto-increment version per enquiryId', async () => {
      vi.mocked(prisma.customerQuotation.count).mockResolvedValue(3);
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-2' } as any);

      await service.generateQuotation({ ...input, enquiryId: 'ce-1' }, userId);

      expect(prisma.customerQuotation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ version: 4 }),
      }));
    });

    it('should update enquiry status to QUOTED when linked', async () => {
      vi.mocked(prisma.customerQuotation.count).mockResolvedValue(0);
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-1' } as any);
      vi.mocked(prisma.customerEnquiry.update).mockResolvedValue({} as any);

      await service.generateQuotation({ ...input, enquiryId: 'ce-1' }, userId);

      expect(prisma.customerEnquiry.update).toHaveBeenCalledWith({
        where: { id: 'ce-1' },
        data: { status: 'QUOTED' },
      });
    });

    it('should NOT update enquiry when no enquiryId', async () => {
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-1' } as any);
      await service.generateQuotation(input, userId);
      expect(prisma.customerEnquiry.update).not.toHaveBeenCalled();
    });

    it('should auto-create single item when items not provided', async () => {
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-1' } as any);
      await service.generateQuotation(input, userId);
      expect(prisma.customerQuotation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [expect.objectContaining({ productName: 'Motor', quantity: 10, unitPrice: 500, totalPrice: 5000 })] },
        }),
      }));
    });

    it('should use provided items array when present', async () => {
      const withItems = {
        ...input,
        items: [
          { productName: 'Motor A', quantity: 5, unitPrice: 200 },
          { productName: 'Motor B', quantity: 3, unitPrice: 300 },
        ],
      };
      vi.mocked(prisma.customerQuotation.create).mockResolvedValue({ id: 'cq-1' } as any);
      await service.generateQuotation(withItems, userId);
      expect(prisma.customerQuotation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          items: { create: expect.arrayContaining([
            expect.objectContaining({ productName: 'Motor A', totalPrice: 1000 }),
            expect.objectContaining({ productName: 'Motor B', totalPrice: 900 }),
          ]) },
        }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // confirmOrder — Feasibility Gate
  // ════════════════════════════════════════════════════════════════════════

  describe('confirmOrder', () => {
    const input = { customerName: 'Acme', productName: 'Motor 500W', quantity: 10, totalAmount: 50000 };

    it('should confirm order without feasibility check when no BOM exists', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue(null); // no BOM
      vi.mocked(prisma.customerOrder.create).mockResolvedValue({ id: 'ord-1' } as any);

      await expect(service.confirmOrder(input, userId)).resolves.toBeDefined();
      expect(prisma.inventory.groupBy).not.toHaveBeenCalled();
    });

    it('should confirm order when BOM exists and all materials are sufficient', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue({
        items: [{ materialId: 'm1', quantity: 2, material: { id: 'm1', name: 'M1', code: 'C1', unit: 'pcs' } }],
      } as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'm1', _sum: { availableQty: 100 } },
      ] as any);
      vi.mocked(prisma.customerOrder.create).mockResolvedValue({ id: 'ord-1' } as any);
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([
        { id: 'inv-1', quantity: 100, availableQty: 100 },
      ] as any);
      vi.mocked(prisma.inventory.update).mockResolvedValue({} as any);
      vi.mocked(prisma.inventoryTransaction.create).mockResolvedValue({} as any);

      await expect(service.confirmOrder(input, userId)).resolves.toBeDefined();
    });

    it('should throw AppError when BOM exists but materials insufficient', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue({
        items: [{ materialId: 'm1', quantity: 10, material: { id: 'm1', name: 'Copper', code: 'CW', unit: 'kg' } }],
      } as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'm1', _sum: { availableQty: 5 } }, // need 100, have 5
      ] as any);

      await expect(service.confirmOrder(input, userId)).rejects.toThrow(AppError);
      await expect(service.confirmOrder(input, userId)).rejects.toThrow(/insufficient materials/i);
    });

    it('should include shortage details in error message', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue({
        items: [
          { materialId: 'm1', quantity: 5, material: { id: 'm1', name: 'Copper Wire', code: 'CW', unit: 'kg' } },
          { materialId: 'm2', quantity: 3, material: { id: 'm2', name: 'Steel Rod', code: 'SR', unit: 'pcs' } },
        ],
      } as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'm1', _sum: { availableQty: 10 } }, // need 50, have 10
        { materialId: 'm2', _sum: { availableQty: 100 } }, // need 30, have 100 ✓
      ] as any);

      try {
        await service.confirmOrder(input, userId);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Copper Wire');
        expect(err.message).not.toContain('Steel Rod');
      }
    });

    it('should consume inventory using FIFO across multiple records', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue({
        items: [{ materialId: 'm1', quantity: 3, material: { id: 'm1', name: 'M1', code: 'C1', unit: 'pcs' } }],
      } as any);
      vi.mocked(prisma.inventory.groupBy).mockResolvedValue([
        { materialId: 'm1', _sum: { availableQty: 50 } },
      ] as any);
      vi.mocked(prisma.customerOrder.create).mockResolvedValue({ id: 'ord-1', orderNo: 'ORD-001' } as any);
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([
        { id: 'inv-1', quantity: 20, availableQty: 20 },
        { id: 'inv-2', quantity: 30, availableQty: 30 },
      ] as any);
      vi.mocked(prisma.inventory.update).mockResolvedValue({} as any);
      vi.mocked(prisma.inventoryTransaction.create).mockResolvedValue({} as any);

      await service.confirmOrder(input, userId); // needs 3×10=30

      // Should consume 20 from inv-1, 10 from inv-2
      expect(prisma.inventory.update).toHaveBeenCalledTimes(2);
      expect(prisma.inventory.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inv-1' }, data: { quantity: 0, availableQty: 0 },
      }));
      expect(prisma.inventory.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inv-2' }, data: { quantity: 20, availableQty: 20 },
      }));
    });

    it('should update linked quotation to ACCEPTED', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customerOrder.create).mockResolvedValue({ id: 'ord-1' } as any);
      vi.mocked(prisma.customerQuotation.update).mockResolvedValue({} as any);

      await service.confirmOrder({ ...input, quotationId: 'cq-1' }, userId);

      expect(prisma.customerQuotation.update).toHaveBeenCalledWith({
        where: { id: 'cq-1' }, data: { status: 'ACCEPTED' },
      });
    });

    it('should NOT update quotation when quotationId absent', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customerOrder.create).mockResolvedValue({ id: 'ord-1' } as any);
      await service.confirmOrder(input, userId);
      expect(prisma.customerQuotation.update).not.toHaveBeenCalled();
    });

    it('should write audit log with feasibilityChecked flag', async () => {
      vi.mocked(prisma.bOM.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customerOrder.create).mockResolvedValue({ id: 'ord-1' } as any);

      await service.confirmOrder(input, userId);

      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CONFIRM_ORDER',
        metadata: expect.objectContaining({ feasibilityChecked: false }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // listOrders
  // ════════════════════════════════════════════════════════════════════════

  describe('listOrders', () => {
    it('should filter by status', async () => {
      vi.mocked(prisma.customerOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customerOrder.count).mockResolvedValue(0);
      await service.listOrders({ page: 1, limit: 20, skip: 0 }, { status: 'CONFIRMED' });
      expect(prisma.customerOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'CONFIRMED' }),
      }));
    });

    it('should return orders and total', async () => {
      vi.mocked(prisma.customerOrder.findMany).mockResolvedValue([{ id: 'o1' }] as any);
      vi.mocked(prisma.customerOrder.count).mockResolvedValue(1);
      const result = await service.listOrders({ page: 1, limit: 20, skip: 0 }, {});
      expect(result).toEqual({ orders: [{ id: 'o1' }], total: 1 });
    });
  });
});
