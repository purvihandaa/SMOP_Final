import prisma from '../../config/database';
import { PaginationParams } from '../../types';
import { generateSequenceNumber } from '../../utils/sequence';
import { writeAuditLog } from '../../utils/auditLogger';
import { NotFoundError, AppError } from '../../utils/errors';
import { CreatePurchaseOrderInput, CreateFromQuotationInput, UpdatePOStatusInput } from './purchaseOrders.validator';
import { PurchaseOrderStatus, QuotationStatus, Prisma } from '@prisma/client';

// Allowed PO status transitions
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: [PurchaseOrderStatus.PENDING_APPROVAL, PurchaseOrderStatus.CANCELLED],
  PENDING_APPROVAL: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CANCELLED],
  APPROVED: [PurchaseOrderStatus.SENT_TO_SUPPLIER, PurchaseOrderStatus.CANCELLED],
  SENT_TO_SUPPLIER: [PurchaseOrderStatus.PARTIALLY_DELIVERED, PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.CANCELLED],
  PARTIALLY_DELIVERED: [PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.CANCELLED],
  DELIVERED: [PurchaseOrderStatus.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};

export class PurchaseOrdersService {
  async createPurchaseOrder(input: CreatePurchaseOrderInput, userId: string) {
    // If quotationId is provided, validate it's APPROVED
    if (input.quotationId) {
      const quotation = await prisma.supplierQuotation.findUnique({
        where: { id: input.quotationId },
      });
      if (!quotation) {
        throw new NotFoundError('SupplierQuotation', input.quotationId);
      }
      if (quotation.status !== QuotationStatus.APPROVED) {
        throw new AppError(
          `Cannot create PO from quotation with status '${quotation.status}'. Only APPROVED quotations can be used.`,
          422,
        );
      }
    }

    const poNumber = await generateSequenceNumber('PO', 'purchaseOrder');
    const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: input.supplierId,
        status: PurchaseOrderStatus.DRAFT,
        totalAmount,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        remarks: input.remarks,
        createdById: userId,
        items: {
          create: input.items.map(item => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            unit: item.unit || 'pcs',
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'CREATE_PO',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      metadata: { poNumber, supplierId: input.supplierId, totalAmount },
    });

    return po;
  }

  async createFromQuotation(input: CreateFromQuotationInput, userId: string) {
    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id: input.quotationId },
      include: {
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (!quotation) {
      throw new NotFoundError('SupplierQuotation', input.quotationId);
    }

    if (quotation.status !== QuotationStatus.APPROVED) {
      throw new AppError(
        `Cannot create PO from quotation with status '${quotation.status}'. Only APPROVED quotations are allowed.`,
        422,
      );
    }

    const poNumber = await generateSequenceNumber('PO', 'purchaseOrder');
    const totalAmount = quotation.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: quotation.supplierId,
        status: PurchaseOrderStatus.DRAFT,
        totalAmount,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        remarks: input.remarks || `Created from quotation ${quotation.quotationNo}`,
        createdById: userId,
        items: {
          create: quotation.items.map(item => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            unit: item.unit || 'pcs',
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'CREATE_PO_FROM_QUOTATION',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      metadata: { poNumber, quotationNo: quotation.quotationNo, supplierId: quotation.supplierId, totalAmount },
    });

    return po;
  }

  async getById(id: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        receipts: {
          select: {
            id: true,
            receiptNo: true,
            status: true,
            createdAt: true,
            items: {
              select: { batchId: true, quantity: true },
            },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    if (!po) {
      throw new NotFoundError('PurchaseOrder', id);
    }

    return po;
  }

  async listPurchaseOrders(
    pagination: PaginationParams,
    filters: { search?: string; status?: string; supplierId?: string },
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {};

    if (filters.status) {
      where.status = filters.status as PurchaseOrderStatus;
    }
    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters.search) {
      where.OR = [
        { poNumber: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: { material: { select: { id: true, name: true, code: true, unit: true } } },
          },
          receipts: {
            select: {
              id: true,
              receiptNo: true,
              status: true,
              items: { select: { batchId: true, quantity: true } },
            },
          },
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { orders, total };
  }

  async updateStatus(input: UpdatePOStatusInput, userId: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: input.id },
    });

    if (!po) {
      throw new NotFoundError('PurchaseOrder', input.id);
    }

    const newStatus = input.status as PurchaseOrderStatus;
    const allowed = ALLOWED_TRANSITIONS[po.status];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition PO from '${po.status}' to '${newStatus}'. Allowed transitions: ${allowed.join(', ') || 'none'}`,
        422,
      );
    }

    const updateData: Prisma.PurchaseOrderUpdateInput = {
      status: newStatus,
      remarks: input.remarks ?? po.remarks,
    };

    if (newStatus === PurchaseOrderStatus.APPROVED) {
      updateData.approvedDate = new Date();
    }
    if (newStatus === PurchaseOrderStatus.DELIVERED) {
      updateData.deliveryDate = new Date();
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: input.id },
      data: updateData,
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'UPDATE_PO_STATUS',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      metadata: { poNumber: po.poNumber, fromStatus: po.status, toStatus: newStatus },
    });

    return updated;
  }
}

export const purchaseOrdersService = new PurchaseOrdersService();
