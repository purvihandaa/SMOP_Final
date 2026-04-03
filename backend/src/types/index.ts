import { UserRole } from '@prisma/client';
import { Request } from 'express';

// ============================================================================
// Auth Types
// ============================================================================

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// ============================================================================
// Query Params
// ============================================================================

export interface ListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Feasibility Types
// ============================================================================

export interface FeasibilityResult {
  feasible: boolean;
  bomId: string;
  productName: string;
  requestedQuantity: number;
  maxProducibleQuantity: number;
  materials: MaterialFeasibility[];
}

export interface MaterialFeasibility {
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  requiredQty: number;
  availableQty: number;
  shortage: number;
  isSufficient: boolean;
}

export interface ScenarioResult extends FeasibilityResult {
  scenarioId: string;
  inventoryImpact: InventoryImpact[];
}

export interface InventoryImpact {
  materialId: string;
  materialName: string;
  currentQty: number;
  requiredQty: number;
  remainingQty: number;
}
