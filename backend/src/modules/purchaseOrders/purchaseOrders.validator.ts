import { z } from 'zod';

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  quotationId: z.string().optional(),
  expectedDate: z.string().datetime().optional(),
  remarks: z.string().optional(),
  items: z.array(z.object({
    materialId: z.string().min(1, 'Material ID is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive'),
    unit: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

export const createFromQuotationSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
  expectedDate: z.string().datetime().optional(),
  remarks: z.string().optional(),
});

export const updatePOStatusSchema = z.object({
  id: z.string().min(1, 'Purchase order ID is required'),
  status: z.enum([
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_SUPPLIER',
    'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED',
  ]),
  remarks: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreateFromQuotationInput = z.infer<typeof createFromQuotationSchema>;
export type UpdatePOStatusInput = z.infer<typeof updatePOStatusSchema>;
