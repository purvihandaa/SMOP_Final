import { z } from 'zod';

export const materialReceiptSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase Order ID is required'),
  remarks: z.string().optional(),
  items: z.array(z.object({
    materialId: z.string().min(1, 'Material ID is required'),
    quantity: z.number().positive('Quantity must be positive'),
    batchNumber: z.string().optional(),
    manufacturingDate: z.string().datetime().optional(),
    expiryDate: z.string().datetime().optional(),
    remarks: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

export const materialInspectionSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  result: z.enum(['ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED']),
  inspectedQty: z.number().positive('Inspected quantity must be positive'),
  acceptedQty: z.number().min(0, 'Accepted quantity cannot be negative'),
  rejectedQty: z.number().min(0, 'Rejected quantity cannot be negative'),
  remarks: z.string().optional(),
});

export const createBatchSchema = z.object({
  materialId: z.string().min(1, 'Material ID is required'),
  supplierId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  manufacturingDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export const updateLocationSchema = z.object({
  inventoryId: z.string().min(1, 'Inventory ID is required'),
  newLocationId: z.string().min(1, 'New location ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  remarks: z.string().optional(),
});

export type MaterialReceiptInput = z.infer<typeof materialReceiptSchema>;
export type MaterialInspectionInput = z.infer<typeof materialInspectionSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
