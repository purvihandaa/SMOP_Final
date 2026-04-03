import { z } from 'zod';

export const createProcessSchema = z.object({
  name: z.string().min(1, 'Process name is required'),
  description: z.string().optional(),
  steps: z.array(z.object({
    stepNumber: z.number().int().positive(),
    name: z.string().min(1),
    description: z.string().optional(),
    estimatedMinutes: z.number().positive().optional(),
    instructions: z.string().optional(),
  })).optional(),
  estimatedTime: z.number().positive().optional(),
});

export const createBOMSchema = z.object({
  name: z.string().min(1, 'BOM name is required'),
  productName: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  items: z.array(z.object({
    materialId: z.string().min(1, 'Material ID is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unit: z.string().optional(),
    remarks: z.string().optional(),
  })).min(1, 'At least one BOM item is required'),
});

export const feasibilityAnalyzeSchema = z.object({
  bomId: z.string().min(1, 'BOM ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
});

export const scenarioSchema = z.object({
  bomId: z.string().min(1, 'BOM ID is required'),
  quantities: z.array(z.number().positive()).min(1, 'At least one quantity required'),
});

export type CreateProcessInput = z.infer<typeof createProcessSchema>;
export type CreateBOMInput = z.infer<typeof createBOMSchema>;
export type FeasibilityAnalyzeInput = z.infer<typeof feasibilityAnalyzeSchema>;
export type ScenarioInput = z.infer<typeof scenarioSchema>;
