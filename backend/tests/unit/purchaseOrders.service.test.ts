import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../src/config/database', () => ({
  default: {
    supplierQuotation: { findUnique: vi.fn() },
    purchaseOrder: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../../src/utils/auditLogger', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../../src/utils/sequence', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('PO-2026-001') }));

import prisma from '../../src/config/database';
import { writeAuditLog } from '../../src/utils/auditLogger';
import { PurchaseOrdersService } from '../../src/modules/purchaseOrders/purchaseOrders.service';
import { NotFoundError, AppError } from '../../src/utils/errors';

const service = new PurchaseOrdersService();
const userId = 'user-001';

describe('PurchaseOrdersService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // createPurchaseOrder
  // ════════════════════════════════════════════════════════════════════════

  describe('createPurchaseOrder', () => {
    const baseInput = {
      supplierId: 'sup-1',
      items: [
        { materialId: 'm1', quantity: 10, unitPrice: 100 },
        { materialId: 'm2', quantity: 5, unitPrice: 200 },
      ],
    };

    it('should create PO with correct total amount (10*100 + 5*200 = 2000)', async () => {
      vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({ id: 'po-1', totalAmount: 2000 } as any);

      await service.createPurchaseOrder(baseInput, userId);

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 2000, status: 'DRAFT' }),
      }));
    });

    it('should validate quotation is APPROVED when quotationId provided', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({ id: 'q1', status: 'APPROVED' } as any);
      vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({ id: 'po-1' } as any);

      await expect(service.createPurchaseOrder({ ...baseInput, quotationId: 'q1' }, userId)).resolves.toBeDefined();
    });

    it('should reject when quotation status is not APPROVED', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({ id: 'q1', status: 'RECEIVED' } as any);

      await expect(service.createPurchaseOrder({ ...baseInput, quotationId: 'q1' }, userId)).rejects.toThrow(AppError);
    });

    it('should throw NotFoundError for non-existent quotation', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue(null);

      await expect(service.createPurchaseOrder({ ...baseInput, quotationId: 'q-nope' }, userId)).rejects.toThrow(/not found/i);
    });

    it('should default item unit to "pcs" when not provided', async () => {
      vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({ id: 'po-1' } as any);

      await service.createPurchaseOrder({ supplierId: 's1', items: [{ materialId: 'm1', quantity: 1, unitPrice: 10 }] }, userId);

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [expect.objectContaining({ unit: 'pcs', totalPrice: 10 })] },
        }),
      }));
    });

    it('should write audit log on creation', async () => {
      vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({ id: 'po-1' } as any);
      await service.createPurchaseOrder(baseInput, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE_PO' }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // createFromQuotation
  // ════════════════════════════════════════════════════════════════════════

  describe('createFromQuotation', () => {
    it('should throw NotFoundError for non-existent quotation', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue(null);
      await expect(service.createFromQuotation({ quotationId: 'q-nope' }, userId)).rejects.toThrow(/not found/i);
    });

    it('should reject non-APPROVED quotation', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({
        id: 'q1', status: 'UNDER_REVIEW', supplierId: 's1', quotationNo: 'SQ-001',
        items: [], supplier: { id: 's1', name: 'S1' },
      } as any);
      await expect(service.createFromQuotation({ quotationId: 'q1' }, userId)).rejects.toThrow(AppError);
    });

    it('should create PO from APPROVED quotation with correct total', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({
        id: 'q1', status: 'APPROVED', supplierId: 's1', quotationNo: 'SQ-001',
        items: [{ materialId: 'm1', quantity: 10, unitPrice: 50, unit: 'kg', material: {} }],
        supplier: { id: 's1', name: 'S1' },
      } as any);
      vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({ id: 'po-1' } as any);

      await service.createFromQuotation({ quotationId: 'q1' }, userId);

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 500, status: 'DRAFT', supplierId: 's1' }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // updateStatus — State Machine Exhaustive Testing
  // ════════════════════════════════════════════════════════════════════════

  describe('updateStatus', () => {
    it('should throw NotFoundError when PO missing', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue(null);
      await expect(service.updateStatus({ id: 'x', status: 'APPROVED' }, userId)).rejects.toThrow(/not found/i);
    });

    // Valid transitions
    const validTransitions = [
      ['DRAFT', 'PENDING_APPROVAL'],
      ['DRAFT', 'CANCELLED'],
      ['PENDING_APPROVAL', 'APPROVED'],
      ['PENDING_APPROVAL', 'CANCELLED'],
      ['APPROVED', 'SENT_TO_SUPPLIER'],
      ['APPROVED', 'CANCELLED'],
      ['SENT_TO_SUPPLIER', 'PARTIALLY_DELIVERED'],
      ['SENT_TO_SUPPLIER', 'DELIVERED'],
      ['SENT_TO_SUPPLIER', 'CANCELLED'],
      ['PARTIALLY_DELIVERED', 'DELIVERED'],
      ['PARTIALLY_DELIVERED', 'CANCELLED'],
      ['DELIVERED', 'CLOSED'],
    ];

    it.each(validTransitions)('should allow transition from %s → %s', async (from, to) => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1', status: from, poNumber: 'PO-001', remarks: null } as any);
      vi.mocked(prisma.purchaseOrder.update).mockResolvedValue({ id: 'po-1', status: to } as any);

      await expect(service.updateStatus({ id: 'po-1', status: to }, userId)).resolves.toBeDefined();
    });

    // Invalid transitions
    const invalidTransitions = [
      ['DRAFT', 'APPROVED'],
      ['DRAFT', 'DELIVERED'],
      ['PENDING_APPROVAL', 'DELIVERED'],
      ['APPROVED', 'DRAFT'],
      ['DELIVERED', 'APPROVED'],
      ['CLOSED', 'DRAFT'],
      ['CLOSED', 'APPROVED'],
      ['CANCELLED', 'DRAFT'],
      ['CANCELLED', 'APPROVED'],
    ];

    it.each(invalidTransitions)('should reject transition from %s → %s', async (from, to) => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1', status: from, poNumber: 'PO-001' } as any);
      await expect(service.updateStatus({ id: 'po-1', status: to }, userId)).rejects.toThrow(AppError);
    });

    // Terminal states
    it.each(['CLOSED', 'CANCELLED'])('should reject all transitions from terminal state %s', async (status) => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1', status, poNumber: 'PO-001' } as any);
      await expect(service.updateStatus({ id: 'po-1', status: 'APPROVED' }, userId)).rejects.toThrow(AppError);
    });

    it('should set approvedDate when transitioning to APPROVED', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1', status: 'PENDING_APPROVAL', poNumber: 'PO-001', remarks: null } as any);
      vi.mocked(prisma.purchaseOrder.update).mockResolvedValue({ id: 'po-1' } as any);

      await service.updateStatus({ id: 'po-1', status: 'APPROVED' }, userId);

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvedDate: expect.any(Date) }),
      }));
    });

    it('should set deliveryDate when transitioning to DELIVERED', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1', status: 'SENT_TO_SUPPLIER', poNumber: 'PO-001', remarks: null } as any);
      vi.mocked(prisma.purchaseOrder.update).mockResolvedValue({ id: 'po-1' } as any);

      await service.updateStatus({ id: 'po-1', status: 'DELIVERED' }, userId);

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'DELIVERED', deliveryDate: expect.any(Date) }),
      }));
    });

    it('should write audit log with from/to status', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1', status: 'DRAFT', poNumber: 'PO-001', remarks: null } as any);
      vi.mocked(prisma.purchaseOrder.update).mockResolvedValue({ id: 'po-1' } as any);

      await service.updateStatus({ id: 'po-1', status: 'PENDING_APPROVAL' }, userId);

      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE_PO_STATUS',
        metadata: expect.objectContaining({ fromStatus: 'DRAFT', toStatus: 'PENDING_APPROVAL' }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // getById
  // ════════════════════════════════════════════════════════════════════════

  describe('getById', () => {
    it('should return PO when found', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1' } as any);
      const result = await service.getById('po-1');
      expect(result.id).toBe('po-1');
    });

    it('should throw NotFoundError when PO missing', async () => {
      vi.mocked(prisma.purchaseOrder.findUnique).mockResolvedValue(null);
      await expect(service.getById('nope')).rejects.toThrow(/not found/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // listPurchaseOrders
  // ════════════════════════════════════════════════════════════════════════

  describe('listPurchaseOrders', () => {
    it('should apply search filter to poNumber and supplier name', async () => {
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.purchaseOrder.count).mockResolvedValue(0);

      await service.listPurchaseOrders({ page: 1, limit: 20, skip: 0 }, { search: 'PO-001' });

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }));
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.purchaseOrder.count).mockResolvedValue(0);

      await service.listPurchaseOrders({ page: 1, limit: 20, skip: 0 }, { status: 'APPROVED' });

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'APPROVED' }),
      }));
    });

    it('should return orders and total', async () => {
      vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([{ id: 'po-1' }] as any);
      vi.mocked(prisma.purchaseOrder.count).mockResolvedValue(1);

      const result = await service.listPurchaseOrders({ page: 1, limit: 20, skip: 0 }, {});

      expect(result).toEqual({ orders: [{ id: 'po-1' }], total: 1 });
    });
  });
});
