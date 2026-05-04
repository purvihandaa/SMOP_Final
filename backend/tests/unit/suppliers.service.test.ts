import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../src/config/database', () => ({
  default: {
    supplierEnquiry: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    supplierQuotation: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    supplier: { findMany: vi.fn() },
  },
}));
vi.mock('../../src/utils/auditLogger', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../../src/utils/sequence', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('SEQ-001') }));

import prisma from '../../src/config/database';
import { writeAuditLog } from '../../src/utils/auditLogger';
import { SuppliersService } from '../../src/modules/suppliers/suppliers.service';
import { NotFoundError, AppError } from '../../src/utils/errors';

const service = new SuppliersService();
const userId = 'user-001';

describe('SuppliersService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // createEnquiry
  // ════════════════════════════════════════════════════════════════════════

  describe('createEnquiry', () => {
    const input = { supplierId: 's1', items: [{ materialId: 'm1', quantity: 10 }] };

    it('should create enquiry with DRAFT status', async () => {
      vi.mocked(prisma.supplierEnquiry.create).mockResolvedValue({ id: 'enq-1', status: 'DRAFT' } as any);
      await service.createEnquiry(input, userId);
      expect(prisma.supplierEnquiry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT', supplierId: 's1' }),
      }));
    });

    it('should default item unit to "pcs"', async () => {
      vi.mocked(prisma.supplierEnquiry.create).mockResolvedValue({ id: 'enq-1' } as any);
      await service.createEnquiry(input, userId);
      expect(prisma.supplierEnquiry.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [expect.objectContaining({ unit: 'pcs' })] },
        }),
      }));
    });

    it('should write audit log', async () => {
      vi.mocked(prisma.supplierEnquiry.create).mockResolvedValue({ id: 'enq-1' } as any);
      await service.createEnquiry(input, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE_ENQUIRY', metadata: expect.objectContaining({ itemCount: 1 }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // updateEnquiryStatus — State Machine
  // ════════════════════════════════════════════════════════════════════════

  describe('updateEnquiryStatus', () => {
    it('should throw NotFoundError when enquiry missing', async () => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue(null);
      await expect(service.updateEnquiryStatus({ id: 'x', status: 'SENT' }, userId)).rejects.toThrow(/not found/i);
    });

    // Valid transitions
    const validEnquiryTransitions = [
      ['DRAFT', 'SENT'],
      ['DRAFT', 'CLOSED'],
      ['SENT', 'RESPONDED'],
      ['SENT', 'CLOSED'],
      ['RESPONDED', 'CLOSED'],
    ];

    it.each(validEnquiryTransitions)('should allow enquiry transition %s → %s', async (from, to) => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue({ id: 'enq-1', status: from, enquiryNo: 'ENQ-001', remarks: null } as any);
      vi.mocked(prisma.supplierEnquiry.update).mockResolvedValue({ id: 'enq-1', status: to } as any);
      await expect(service.updateEnquiryStatus({ id: 'enq-1', status: to }, userId)).resolves.toBeDefined();
    });

    // Invalid transitions
    const invalidEnquiryTransitions = [
      ['DRAFT', 'RESPONDED'],
      ['SENT', 'DRAFT'],
      ['RESPONDED', 'DRAFT'],
      ['RESPONDED', 'SENT'],
      ['CLOSED', 'DRAFT'],
      ['CLOSED', 'SENT'],
      ['CLOSED', 'RESPONDED'],
    ];

    it.each(invalidEnquiryTransitions)('should reject enquiry transition %s → %s', async (from, to) => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue({ id: 'enq-1', status: from, enquiryNo: 'ENQ-001' } as any);
      await expect(service.updateEnquiryStatus({ id: 'enq-1', status: to }, userId)).rejects.toThrow(AppError);
    });

    it('should set sentDate when transitioning to SENT', async () => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue({ id: 'enq-1', status: 'DRAFT', enquiryNo: 'ENQ-001', remarks: null } as any);
      vi.mocked(prisma.supplierEnquiry.update).mockResolvedValue({ id: 'enq-1' } as any);

      await service.updateEnquiryStatus({ id: 'enq-1', status: 'SENT' }, userId);

      expect(prisma.supplierEnquiry.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ sentDate: expect.any(Date) }),
      }));
    });

    it('should NOT set sentDate when transitioning to non-SENT status', async () => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue({ id: 'enq-1', status: 'DRAFT', enquiryNo: 'ENQ-001', remarks: null } as any);
      vi.mocked(prisma.supplierEnquiry.update).mockResolvedValue({ id: 'enq-1' } as any);

      await service.updateEnquiryStatus({ id: 'enq-1', status: 'CLOSED' }, userId);

      const callData = vi.mocked(prisma.supplierEnquiry.update).mock.calls[0][0].data as any;
      expect(callData.sentDate).toBeUndefined();
    });

    it('should write audit log with from/to status', async () => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue({ id: 'enq-1', status: 'DRAFT', enquiryNo: 'ENQ-001', remarks: null } as any);
      vi.mocked(prisma.supplierEnquiry.update).mockResolvedValue({ id: 'enq-1' } as any);
      await service.updateEnquiryStatus({ id: 'enq-1', status: 'SENT' }, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({ fromStatus: 'DRAFT', toStatus: 'SENT' }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // getEnquiryById
  // ════════════════════════════════════════════════════════════════════════

  describe('getEnquiryById', () => {
    it('should return enquiry when found', async () => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue({ id: 'enq-1' } as any);
      const result = await service.getEnquiryById('enq-1');
      expect(result.id).toBe('enq-1');
    });

    it('should throw NotFoundError when missing', async () => {
      vi.mocked(prisma.supplierEnquiry.findUnique).mockResolvedValue(null);
      await expect(service.getEnquiryById('nope')).rejects.toThrow(/not found/i);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // addQuotation
  // ════════════════════════════════════════════════════════════════════════

  describe('addQuotation', () => {
    const input = {
      supplierId: 's1',
      items: [
        { materialId: 'm1', quantity: 10, unitPrice: 50 },
        { materialId: 'm2', quantity: 5, unitPrice: 100 },
      ],
    };

    it('should calculate totalAmount correctly (10*50 + 5*100 = 1000)', async () => {
      vi.mocked(prisma.supplierQuotation.create).mockResolvedValue({ id: 'q1', totalAmount: 1000 } as any);
      await service.addQuotation(input, userId);
      expect(prisma.supplierQuotation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 1000, status: 'RECEIVED' }),
      }));
    });

    it('should update linked enquiry to RESPONDED when enquiryId provided', async () => {
      vi.mocked(prisma.supplierQuotation.create).mockResolvedValue({ id: 'q1' } as any);
      vi.mocked(prisma.supplierEnquiry.update).mockResolvedValue({ id: 'enq-1' } as any);

      await service.addQuotation({ ...input, enquiryId: 'enq-1' }, userId);

      expect(prisma.supplierEnquiry.update).toHaveBeenCalledWith({
        where: { id: 'enq-1' },
        data: { status: 'RESPONDED', responseDate: expect.any(Date) },
      });
    });

    it('should NOT update enquiry when enquiryId is absent', async () => {
      vi.mocked(prisma.supplierQuotation.create).mockResolvedValue({ id: 'q1' } as any);
      await service.addQuotation(input, userId);
      expect(prisma.supplierEnquiry.update).not.toHaveBeenCalled();
    });

    it('should write audit log', async () => {
      vi.mocked(prisma.supplierQuotation.create).mockResolvedValue({ id: 'q1' } as any);
      await service.addQuotation(input, userId);
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ADD_QUOTATION', metadata: expect.objectContaining({ totalAmount: 1000 }),
      }));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // updateQuotationStatus — State Machine
  // ════════════════════════════════════════════════════════════════════════

  describe('updateQuotationStatus', () => {
    it('should throw NotFoundError when quotation missing', async () => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue(null);
      await expect(service.updateQuotationStatus({ id: 'x', status: 'APPROVED' }, userId)).rejects.toThrow(/not found/i);
    });

    // Valid transitions
    const validQuotTransitions = [
      ['RECEIVED', 'UNDER_REVIEW'],
      ['RECEIVED', 'REJECTED'],
      ['UNDER_REVIEW', 'APPROVED'],
      ['UNDER_REVIEW', 'REJECTED'],
    ];

    it.each(validQuotTransitions)('should allow quotation transition %s → %s', async (from, to) => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({ id: 'q1', status: from, quotationNo: 'SQ-001', remarks: null } as any);
      vi.mocked(prisma.supplierQuotation.update).mockResolvedValue({ id: 'q1', status: to } as any);
      await expect(service.updateQuotationStatus({ id: 'q1', status: to }, userId)).resolves.toBeDefined();
    });

    // Invalid transitions
    const invalidQuotTransitions = [
      ['RECEIVED', 'APPROVED'],
      ['APPROVED', 'RECEIVED'],
      ['APPROVED', 'REJECTED'],
      ['APPROVED', 'UNDER_REVIEW'],
      ['REJECTED', 'RECEIVED'],
      ['REJECTED', 'APPROVED'],
      ['REJECTED', 'UNDER_REVIEW'],
    ];

    it.each(invalidQuotTransitions)('should reject quotation transition %s → %s', async (from, to) => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({ id: 'q1', status: from, quotationNo: 'SQ-001' } as any);
      await expect(service.updateQuotationStatus({ id: 'q1', status: to }, userId)).rejects.toThrow(AppError);
    });

    // Terminal states
    it.each(['APPROVED', 'REJECTED'])('should reject all transitions from terminal %s', async (status) => {
      vi.mocked(prisma.supplierQuotation.findUnique).mockResolvedValue({ id: 'q1', status, quotationNo: 'SQ-001' } as any);
      await expect(service.updateQuotationStatus({ id: 'q1', status: 'UNDER_REVIEW' }, userId)).rejects.toThrow(AppError);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // listSuppliers
  // ════════════════════════════════════════════════════════════════════════

  describe('listSuppliers', () => {
    it('should return only active suppliers ordered by name', async () => {
      vi.mocked(prisma.supplier.findMany).mockResolvedValue([{ id: 's1', name: 'Alpha' }] as any);
      const result = await service.listSuppliers();
      expect(result).toHaveLength(1);
      expect(prisma.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true }, orderBy: { name: 'asc' },
      }));
    });
  });
});
