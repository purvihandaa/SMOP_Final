import { z } from 'zod';

export const customerEnquirySchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  remarks: z.string().optional(),
});

export const generateQuotationSchema = z.object({
  enquiryId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
  validUntil: z.string().datetime().optional(),
  remarks: z.string().optional(),
  items: z.array(z.object({
    productName: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).optional(),
});

export const confirmOrderSchema = z.object({
  quotationId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  totalAmount: z.number().positive('Total amount must be positive'),
  expectedDelivery: z.string().datetime().optional(),
  remarks: z.string().optional(),
});

export type CustomerEnquiryInput = z.infer<typeof customerEnquirySchema>;
export type GenerateQuotationInput = z.infer<typeof generateQuotationSchema>;
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>;
