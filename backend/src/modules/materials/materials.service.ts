import prisma from '../../config/database';
import { PaginationParams } from '../../types';
import { generateSequenceNumber } from '../../utils/sequence';
import { writeAuditLog } from '../../utils/auditLogger';
import { NotFoundError, AppError } from '../../utils/errors';
import {
  MaterialReceiptInput,
  MaterialInspectionInput,
  CreateBatchInput,
  UpdateLocationInput,
} from './materials.validator';
import {
  ReceiptStatus,
  InspectionResult,
  InventoryTransactionType,
  PurchaseOrderStatus,
  Prisma,
} from '@prisma/client';

export class MaterialsService {
  // =========================================================================
  // MATERIAL RECEIPT — Transactional
  // =========================================================================

  async recordReceipt(input: MaterialReceiptInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Validate PO exists and is in a receivable state
      const po = await tx.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: { items: true },
      });

      if (!po) {
        throw new NotFoundError('PurchaseOrder', input.purchaseOrderId);
      }

      const receivableStatuses: PurchaseOrderStatus[] = [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.SENT_TO_SUPPLIER, PurchaseOrderStatus.PARTIALLY_DELIVERED];
      if (!receivableStatuses.includes(po.status)) {
        throw new AppError(`Cannot receive materials for PO in '${po.status}' status`);
      }

      const receiptNo = await generateSequenceNumber('REC', 'materialReceipt');

      // Create batches and receipt items
      const receiptItemsData: { batchId: string; quantity: number; remarks?: string }[] = [];

      for (const item of input.items) {
        // Create or reuse batch
        const batchNumber = item.batchNumber || await generateSequenceNumber('BATCH', 'materialBatch');

        const batch = await tx.materialBatch.create({
          data: {
            batchNumber,
            materialId: item.materialId,
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            quantity: item.quantity,
            receivedQty: item.quantity,
            manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          },
        });

        receiptItemsData.push({
          batchId: batch.id,
          quantity: item.quantity,
          remarks: item.remarks,
        });

        // Update PO item received quantity
        const poItem = po.items.find(pi => pi.materialId === item.materialId);
        if (poItem) {
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: { receivedQty: { increment: item.quantity } },
          });
        }
      }

      // Create receipt
      const receipt = await tx.materialReceipt.create({
        data: {
          receiptNo,
          purchaseOrderId: po.id,
          status: ReceiptStatus.PENDING_INSPECTION,
          remarks: input.remarks,
          receivedById: userId,
          items: {
            create: receiptItemsData,
          },
        },
        include: {
          purchaseOrder: { select: { id: true, poNumber: true } },
          items: {
            include: {
              batch: {
                include: { material: { select: { id: true, name: true, code: true } } },
              },
            },
          },
          receivedBy: { select: { id: true, fullName: true } },
        },
      });

      // Check if all PO items are fully received
      const updatedPO = await tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { items: true },
      });

      if (updatedPO) {
        const allDelivered = updatedPO.items.every(item => item.receivedQty >= item.quantity);
        const someDelivered = updatedPO.items.some(item => item.receivedQty > 0);

        if (allDelivered) {
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { status: PurchaseOrderStatus.DELIVERED, deliveryDate: new Date() },
          });
        } else if (someDelivered && po.status !== PurchaseOrderStatus.PARTIALLY_DELIVERED) {
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { status: PurchaseOrderStatus.PARTIALLY_DELIVERED },
          });
        }
      }

      await writeAuditLog({
        actorId: userId,
        action: 'RECORD_RECEIPT',
        entityType: 'MaterialReceipt',
        entityId: receipt.id,
        metadata: { receiptNo, poNumber: po.poNumber, itemCount: input.items.length },
      });

      return receipt;
    });
  }

  // =========================================================================
  // MATERIAL INSPECTION — Transactional
  // =========================================================================

  async recordInspection(input: MaterialInspectionInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const batch = await tx.materialBatch.findUnique({
        where: { id: input.batchId },
        include: { material: true },
      });

      if (!batch) {
        throw new NotFoundError('MaterialBatch', input.batchId);
      }

      if (input.acceptedQty + input.rejectedQty > input.inspectedQty) {
        throw new AppError('Accepted + rejected quantity cannot exceed inspected quantity');
      }

      const inspectionNo = await generateSequenceNumber('INS', 'materialInspection');

      // Create inspection record
      const inspection = await tx.materialInspection.create({
        data: {
          inspectionNo,
          batchId: input.batchId,
          result: input.result as InspectionResult,
          inspectedQty: input.inspectedQty,
          acceptedQty: input.acceptedQty,
          rejectedQty: input.rejectedQty,
          remarks: input.remarks,
          inspectedById: userId,
        },
        include: {
          batch: {
            include: { material: { select: { id: true, name: true, code: true, unit: true } } },
          },
          inspectedBy: { select: { id: true, fullName: true } },
        },
      });

      // Update batch quantities
      await tx.materialBatch.update({
        where: { id: input.batchId },
        data: {
          acceptedQty: { increment: input.acceptedQty },
          rejectedQty: { increment: input.rejectedQty },
        },
      });

      // Add accepted quantity to inventory
      if (input.acceptedQty > 0) {
        // Get or create default storage location
        let defaultLocation = await tx.storageLocation.findFirst({
          where: { name: 'Default Warehouse' },
        });

        if (!defaultLocation) {
          defaultLocation = await tx.storageLocation.create({
            data: { name: 'Default Warehouse', zone: 'A', description: 'Default receiving location' },
          });
        }

        // Upsert inventory record
        const existingInventory = await tx.inventory.findUnique({
          where: {
            materialId_locationId: {
              materialId: batch.materialId,
              locationId: defaultLocation.id,
            },
          },
        });

        if (existingInventory) {
          const newQty = existingInventory.quantity + input.acceptedQty;
          const newAvailable = existingInventory.availableQty + input.acceptedQty;

          await tx.inventory.update({
            where: { id: existingInventory.id },
            data: {
              quantity: newQty,
              availableQty: newAvailable,
            },
          });

          // Record transaction
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: existingInventory.id,
              type: InventoryTransactionType.RECEIPT,
              quantity: input.acceptedQty,
              previousQty: existingInventory.quantity,
              newQty: newQty,
              referenceType: 'MaterialInspection',
              referenceId: inspection.id,
              remarks: `Accepted from batch ${batch.batchNumber}`,
              performedById: userId,
            },
          });
        } else {
          const newInventory = await tx.inventory.create({
            data: {
              materialId: batch.materialId,
              locationId: defaultLocation.id,
              quantity: input.acceptedQty,
              availableQty: input.acceptedQty,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryId: newInventory.id,
              type: InventoryTransactionType.RECEIPT,
              quantity: input.acceptedQty,
              previousQty: 0,
              newQty: input.acceptedQty,
              referenceType: 'MaterialInspection',
              referenceId: inspection.id,
              remarks: `Initial receipt from batch ${batch.batchNumber}`,
              performedById: userId,
            },
          });
        }
      }

      // Update receipt status
      const receiptItem = await tx.materialReceiptItem.findFirst({
        where: { batchId: input.batchId },
      });
      if (receiptItem) {
        await tx.materialReceipt.update({
          where: { id: receiptItem.receiptId },
          data: { status: ReceiptStatus.INSPECTED },
        });
      }

      await writeAuditLog({
        actorId: userId,
        action: 'RECORD_INSPECTION',
        entityType: 'MaterialInspection',
        entityId: inspection.id,
        metadata: {
          inspectionNo,
          batchNumber: batch.batchNumber,
          result: input.result,
          acceptedQty: input.acceptedQty,
          rejectedQty: input.rejectedQty,
        },
      });

      return inspection;
    });
  }

  // =========================================================================
  // BATCH
  // =========================================================================

  async createBatch(input: CreateBatchInput, userId: string) {
    const batchNumber = await generateSequenceNumber('BATCH', 'materialBatch');

    const batch = await prisma.materialBatch.create({
      data: {
        batchNumber,
        materialId: input.materialId,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId,
        quantity: input.quantity,
        manufacturingDate: input.manufacturingDate ? new Date(input.manufacturingDate) : null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      },
      include: {
        material: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'CREATE_BATCH',
      entityType: 'MaterialBatch',
      entityId: batch.id,
      metadata: { batchNumber, materialId: input.materialId },
    });

    return batch;
  }

  // =========================================================================
  // INVENTORY
  // =========================================================================

  async viewInventory(pagination: PaginationParams, filters: { search?: string; type?: string; locationId?: string }) {
    const where: Prisma.InventoryWhereInput = {};

    if (filters.type) {
      where.material = { type: filters.type as any };
    }
    if (filters.locationId) {
      where.locationId = filters.locationId;
    }
    if (filters.search) {
      where.material = {
        ...where.material as any,
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          material: { select: { id: true, name: true, code: true, unit: true, type: true } },
          location: { select: { id: true, name: true, zone: true, rack: true, bin: true } },
        },
        orderBy: { material: { name: 'asc' } },
      }),
      prisma.inventory.count({ where }),
    ]);

    return { items, total };
  }

  async updateLocation(input: UpdateLocationInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id: input.inventoryId },
        include: { material: true, location: true },
      });

      if (!inventory) {
        throw new NotFoundError('Inventory', input.inventoryId);
      }

      if (input.quantity > inventory.availableQty) {
        throw new AppError(`Cannot move ${input.quantity} units. Only ${inventory.availableQty} available.`);
      }

      const newLocation = await tx.storageLocation.findUnique({
        where: { id: input.newLocationId },
      });

      if (!newLocation) {
        throw new NotFoundError('StorageLocation', input.newLocationId);
      }

      // Decrement from source
      const newSourceQty = inventory.quantity - input.quantity;
      const newSourceAvailable = inventory.availableQty - input.quantity;

      await tx.inventory.update({
        where: { id: input.inventoryId },
        data: {
          quantity: newSourceQty,
          availableQty: newSourceAvailable,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          type: InventoryTransactionType.TRANSFER,
          quantity: -input.quantity,
          previousQty: inventory.quantity,
          newQty: newSourceQty,
          referenceType: 'LocationTransfer',
          remarks: `Transfer to ${newLocation.name}`,
          performedById: userId,
        },
      });

      // Upsert destination inventory
      const destInventory = await tx.inventory.findUnique({
        where: {
          materialId_locationId: {
            materialId: inventory.materialId,
            locationId: input.newLocationId,
          },
        },
      });

      let destId: string;
      if (destInventory) {
        const newDestQty = destInventory.quantity + input.quantity;
        await tx.inventory.update({
          where: { id: destInventory.id },
          data: {
            quantity: newDestQty,
            availableQty: destInventory.availableQty + input.quantity,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            inventoryId: destInventory.id,
            type: InventoryTransactionType.TRANSFER,
            quantity: input.quantity,
            previousQty: destInventory.quantity,
            newQty: newDestQty,
            referenceType: 'LocationTransfer',
            remarks: `Transfer from ${inventory.location.name}`,
            performedById: userId,
          },
        });

        destId = destInventory.id;
      } else {
        const newDest = await tx.inventory.create({
          data: {
            materialId: inventory.materialId,
            locationId: input.newLocationId,
            quantity: input.quantity,
            availableQty: input.quantity,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            inventoryId: newDest.id,
            type: InventoryTransactionType.TRANSFER,
            quantity: input.quantity,
            previousQty: 0,
            newQty: input.quantity,
            referenceType: 'LocationTransfer',
            remarks: `Transfer from ${inventory.location.name}`,
            performedById: userId,
          },
        });

        destId = newDest.id;
      }

      await writeAuditLog({
        actorId: userId,
        action: 'UPDATE_INVENTORY_LOCATION',
        entityType: 'Inventory',
        entityId: inventory.id,
        metadata: {
          materialName: inventory.material.name,
          fromLocation: inventory.location.name,
          toLocation: newLocation.name,
          quantity: input.quantity,
        },
      });

      return { sourceInventoryId: inventory.id, destinationInventoryId: destId, movedQuantity: input.quantity };
    });
  }

  // =========================================================================
  // STORAGE LOCATIONS (supporting)
  // =========================================================================

  async listLocations() {
    return prisma.storageLocation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listMaterials() {
    return prisma.material.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, unit: true, type: true },
    });
  }

  // =========================================================================
  // RECEIPTS LISTING
  // =========================================================================

  async listReceipts(pagination: PaginationParams, filters: { status?: string; purchaseOrderId?: string }) {
    const where: Prisma.MaterialReceiptWhereInput = {};

    if (filters.status) {
      where.status = filters.status as ReceiptStatus;
    }
    if (filters.purchaseOrderId) {
      where.purchaseOrderId = filters.purchaseOrderId;
    }

    const [receipts, total] = await Promise.all([
      prisma.materialReceipt.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true, supplier: { select: { id: true, name: true } } },
          },
          items: {
            include: {
              batch: {
                include: {
                  material: { select: { id: true, name: true, code: true, unit: true } },
                  inspections: {
                    select: { id: true, result: true, inspectedQty: true, acceptedQty: true, rejectedQty: true },
                  },
                },
              },
            },
          },
          receivedBy: { select: { id: true, fullName: true } },
        },
      }),
      prisma.materialReceipt.count({ where }),
    ]);

    return { receipts, total };
  }
}

export const materialsService = new MaterialsService();

