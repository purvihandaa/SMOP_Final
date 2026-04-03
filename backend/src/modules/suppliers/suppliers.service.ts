import prisma from '../../config/database';
import { PaginationParams } from '../../types';
import { generateSequenceNumber } from '../../utils/sequence';
import { writeAuditLog } from '../../utils/auditLogger';
import { NotFoundError, AppError } from '../../utils/errors';
import {
  CreateEnquiryInput,
  AddQuotationInput,
  UpdateEnquiryStatusInput,
  UpdateQuotationStatusInput,
} from './suppliers.validator';
import { EnquiryStatus, QuotationStatus, Prisma } from '@prisma/client';

// Allowed enquiry status transitions
const ENQUIRY_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  DRAFT: [EnquiryStatus.SENT, EnquiryStatus.CLOSED],
  SENT: [EnquiryStatus.RESPONDED, EnquiryStatus.CLOSED],
  RESPONDED: [EnquiryStatus.CLOSED],
  CLOSED: [],
};

// Allowed quotation status transitions
const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  RECEIVED: [QuotationStatus.UNDER_REVIEW, QuotationStatus.REJECTED],
  UNDER_REVIEW: [QuotationStatus.APPROVED, QuotationStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

export class SuppliersService {
  // =========================================================================
  // ENQUIRIES
  // =========================================================================

  async createEnquiry(input: CreateEnquiryInput, userId: string) {
    const enquiryNo = await generateSequenceNumber('ENQ', 'supplierEnquiry');

    const enquiry = await prisma.supplierEnquiry.create({
      data: {
        enquiryNo,
        supplierId: input.supplierId,
        status: EnquiryStatus.DRAFT,
        remarks: input.remarks,
        createdById: userId,
        items: {
          create: input.items.map(item => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit || 'pcs',
            remarks: item.remarks,
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
      action: 'CREATE_ENQUIRY',
      entityType: 'SupplierEnquiry',
      entityId: enquiry.id,
      metadata: { enquiryNo, supplierId: input.supplierId, itemCount: input.items.length },
    });

    return enquiry;
  }

  async updateEnquiryStatus(input: UpdateEnquiryStatusInput, userId: string) {
    const enquiry = await prisma.supplierEnquiry.findUnique({
      where: { id: input.id },
    });

    if (!enquiry) {
      throw new NotFoundError('SupplierEnquiry', input.id);
    }

    const newStatus = input.status as EnquiryStatus;
    const allowed = ENQUIRY_TRANSITIONS[enquiry.status];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition enquiry from '${enquiry.status}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`,
        422,
      );
    }

    const updateData: Prisma.SupplierEnquiryUpdateInput = {
      status: newStatus,
      remarks: input.remarks ?? enquiry.remarks,
    };

    if (newStatus === EnquiryStatus.SENT) {
      updateData.sentDate = new Date();
    }

    const updated = await prisma.supplierEnquiry.update({
      where: { id: input.id },
      data: updateData,
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
      action: 'UPDATE_ENQUIRY_STATUS',
      entityType: 'SupplierEnquiry',
      entityId: enquiry.id,
      metadata: { enquiryNo: enquiry.enquiryNo, fromStatus: enquiry.status, toStatus: newStatus },
    });

    return updated;
  }

  async getEnquiryById(id: string) {
    const enquiry = await prisma.supplierEnquiry.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        quotations: {
          select: { id: true, quotationNo: true, status: true, totalAmount: true },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    if (!enquiry) {
      throw new NotFoundError('SupplierEnquiry', id);
    }

    return enquiry;
  }

  async listEnquiries(
    pagination: PaginationParams,
    filters: { search?: string; status?: string; supplierId?: string },
  ) {
    const where: Prisma.SupplierEnquiryWhereInput = {};

    if (filters.status) {
      where.status = filters.status as EnquiryStatus;
    }
    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters.search) {
      where.OR = [
        { enquiryNo: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [enquiries, total] = await Promise.all([
      prisma.supplierEnquiry.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: { material: { select: { id: true, name: true, code: true, unit: true } } },
          },
          quotations: {
            select: { id: true, quotationNo: true, status: true, totalAmount: true },
          },
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.supplierEnquiry.count({ where }),
    ]);

    return { enquiries, total };
  }

  // =========================================================================
  // QUOTATIONS
  // =========================================================================

  async addQuotation(input: AddQuotationInput, userId: string) {
    const quotationNo = await generateSequenceNumber('SQ', 'supplierQuotation');
    const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const quotation = await prisma.supplierQuotation.create({
      data: {
        quotationNo,
        supplierId: input.supplierId,
        enquiryId: input.enquiryId || null,
        status: QuotationStatus.RECEIVED,
        totalAmount,
        leadTimeDays: input.leadTimeDays,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        remarks: input.remarks,
        createdById: userId,
        items: {
          create: input.items.map(item => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit || 'pcs',
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        enquiry: { select: { id: true, enquiryNo: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    // If linked to an enquiry, update enquiry status
    if (input.enquiryId) {
      await prisma.supplierEnquiry.update({
        where: { id: input.enquiryId },
        data: { status: EnquiryStatus.RESPONDED, responseDate: new Date() },
      });
    }

    await writeAuditLog({
      actorId: userId,
      action: 'ADD_QUOTATION',
      entityType: 'SupplierQuotation',
      entityId: quotation.id,
      metadata: { quotationNo, supplierId: input.supplierId, totalAmount },
    });

    return quotation;
  }

  async updateQuotationStatus(input: UpdateQuotationStatusInput, userId: string) {
    const quotation = await prisma.supplierQuotation.findUnique({
      where: { id: input.id },
    });

    if (!quotation) {
      throw new NotFoundError('SupplierQuotation', input.id);
    }

    const newStatus = input.status as QuotationStatus;
    const allowed = QUOTATION_TRANSITIONS[quotation.status];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition quotation from '${quotation.status}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`,
        422,
      );
    }

    const updated = await prisma.supplierQuotation.update({
      where: { id: input.id },
      data: {
        status: newStatus,
        remarks: input.remarks ?? quotation.remarks,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        enquiry: { select: { id: true, enquiryNo: true } },
        items: {
          include: { material: { select: { id: true, name: true, code: true, unit: true } } },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'UPDATE_QUOTATION_STATUS',
      entityType: 'SupplierQuotation',
      entityId: quotation.id,
      metadata: { quotationNo: quotation.quotationNo, fromStatus: quotation.status, toStatus: newStatus },
    });

    return updated;
  }

  async listQuotations(
    pagination: PaginationParams,
    filters: { search?: string; status?: string; supplierId?: string },
  ) {
    const where: Prisma.SupplierQuotationWhereInput = {};

    if (filters.status) {
      where.status = filters.status as QuotationStatus;
    }
    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters.search) {
      where.OR = [
        { quotationNo: { contains: filters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [quotations, total] = await Promise.all([
      prisma.supplierQuotation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          enquiry: { select: { id: true, enquiryNo: true } },
          items: {
            include: { material: { select: { id: true, name: true, code: true, unit: true } } },
          },
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.supplierQuotation.count({ where }),
    ]);

    return { quotations, total };
  }

  // =========================================================================
  // SUPPLIER CRUD (supporting)
  // =========================================================================

  async listSuppliers() {
    return prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, contactPerson: true, email: true, phone: true, rating: true },
    });
  }
}

export const suppliersService = new SuppliersService();
