// =============================================================================
// SMOP API Client — Central fetch wrapper + namespaced service functions
// =============================================================================

const API_BASE = '/api';

// -----------------------------------------------------------------------------
// Core fetch wrapper
// -----------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    public errorMessage: string,
    public details?: string,
  ) {
    super(errorMessage);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const json: ApiResponse<T> = await res.json().catch(() => ({
    success: false,
    error: `HTTP ${res.status}: ${res.statusText}`,
  }));

  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      json.error || json.message || 'Request failed',
      json.message,
    );
  }

  return json;
}

async function get<T>(path: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, { method: 'GET' });
}

async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

// -----------------------------------------------------------------------------
// Query string builder
// -----------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export const authApi = {
  login: (username: string, password: string) =>
    post<{
      userId: string;
      username: string;
      role: string;
      fullName: string;
      email: string;
    }>('/auth/login', { username, password }),

  logout: () => post('/auth/logout'),

  session: () =>
    get<{
      id: string;
      username: string;
      email: string;
      fullName: string;
      role: string;
      isActive: boolean;
      lastLogin: string;
    } | null>('/auth/session'),
};

// -----------------------------------------------------------------------------
// Suppliers
// -----------------------------------------------------------------------------

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  supplierId?: string;
}

export const suppliersApi = {
  list: () => get<Array<{ id: string; name: string; contactPerson?: string; email?: string; phone?: string }>>('/suppliers/list'),

  createEnquiry: (data: {
    supplierId: string;
    remarks?: string;
    items: Array<{ materialId: string; quantity: number; unit?: string; remarks?: string }>;
  }) => post('/suppliers/enquiry/create', data),

  listEnquiries: (params?: ListParams) =>
    get<unknown[]>(`/suppliers/enquiry/list${qs(params as Record<string, string | number | undefined> || {})}`),

  getEnquiry: (id: string) =>
    get<unknown>(`/suppliers/enquiry/${id}`),

  updateEnquiryStatus: (data: { id: string; status: string; remarks?: string }) =>
    put('/suppliers/enquiry/update-status', data),

  addQuotation: (data: {
    supplierId: string;
    enquiryId?: string;
    leadTimeDays?: number;
    validUntil?: string;
    remarks?: string;
    items: Array<{ materialId: string; quantity: number; unitPrice: number; unit?: string }>;
  }) => post('/suppliers/quotation/add', data),

  listQuotations: (params?: ListParams) =>
    get<unknown[]>(`/suppliers/quotation/list${qs(params as Record<string, string | number | undefined> || {})}`),

  updateQuotationStatus: (data: { id: string; status: string; remarks?: string }) =>
    put('/suppliers/quotation/update-status', data),
};

// -----------------------------------------------------------------------------
// Purchase Orders
// -----------------------------------------------------------------------------

export const purchaseOrdersApi = {
  create: (data: {
    supplierId: string;
    quotationId?: string;
    expectedDate?: string;
    remarks?: string;
    items: Array<{ materialId: string; quantity: number; unitPrice: number; unit?: string }>;
  }) => post('/purchase-order/create', data),

  createFromQuotation: (data: {
    quotationId: string;
    expectedDate?: string;
    remarks?: string;
  }) => post('/purchase-order/create-from-quotation', data),

  list: (params?: ListParams) =>
    get<unknown[]>(`/purchase-order/list${qs(params as Record<string, string | number | undefined> || {})}`),

  getById: (id: string) =>
    get<unknown>(`/purchase-order/${id}`),

  updateStatus: (data: { id: string; status: string; remarks?: string }) =>
    put('/purchase-order/update-status', data),
};

// -----------------------------------------------------------------------------
// Materials
// -----------------------------------------------------------------------------

export const materialsApi = {
  list: () => get<Array<{ id: string; name: string; code: string; unit?: string; type?: string }>>('/material/list'),

  locations: () => get<Array<{ id: string; name: string; code?: string }>>('/material/locations'),

  recordReceipt: (data: {
    purchaseOrderId: string;
    items: Array<{ materialId: string; quantity: number; unit?: string; remarks?: string; batchNumber?: string }>;
    remarks?: string;
  }) => post('/material/receipt', data),

  recordInspection: (data: {
    batchId: string;
    result: 'ACCEPTED' | 'REJECTED' | 'PARTIALLY_ACCEPTED';
    inspectedQty: number;
    acceptedQty: number;
    rejectedQty?: number;
    remarks?: string;
  }) => post('/material/inspection', data),

  listReceipts: (params?: ListParams & { purchaseOrderId?: string }) =>
    get<unknown[]>(`/material/receipts${qs(params as Record<string, string | number | undefined> || {})}`),

  createBatch: (data: {
    inspectionId: string;
    items: Array<{
      inspectionItemId: string;
      quantity: number;
      locationId?: string;
    }>;
  }) => post('/material/batch/create', data),
};

// -----------------------------------------------------------------------------
// Inventory
// -----------------------------------------------------------------------------

export const inventoryApi = {
  view: (params?: ListParams & { type?: string; locationId?: string }) =>
    get<unknown[]>(`/inventory/view${qs(params as Record<string, string | number | undefined> || {})}`),

  updateLocation: (data: { inventoryId: string; newLocationId: string; quantity: number; remarks?: string }) =>
    put('/inventory/update-location', data),
};

// -----------------------------------------------------------------------------
// Manufacturing
// -----------------------------------------------------------------------------

export const manufacturingApi = {
  createProcess: (data: {
    name: string;
    description?: string;
    estimatedTime?: number;
    steps?: Array<{
      stepNumber: number;
      name: string;
      description?: string;
      estimatedMinutes?: number;
      instructions?: string;
    }>;
  }) => post('/process/create', data),

  createBOM: (data: {
    name: string;
    productName: string;
    description?: string;
    items: Array<{ materialId: string; quantity: number; unit?: string; remarks?: string }>;
  }) => post('/bom/create', data),

  viewBOMs: (params?: { productName?: string; status?: string }) =>
    get<unknown[]>(`/bom/view${qs(params as Record<string, string | number | undefined> || {})}`),

  analyzeFeasibility: (data: { bomId: string; quantity: number }) =>
    post<{
      feasible: boolean;
      bomId: string;
      productName: string;
      requestedQuantity: number;
      maxProducibleQuantity: number;
      materials: Array<{
        materialId: string;
        materialName: string;
        materialCode: string;
        unit: string;
        requiredQty: number;
        availableQty: number;
        shortage: number;
        isSufficient: boolean;
      }>;
    }>('/feasibility/analyze', data),

  runScenario: (data: { bomId: string; quantities: number[] }) =>
    post('/feasibility/scenario', data),

  getWorkerInstructions: (params: { processId?: string; bomId?: string; orderId?: string }) =>
    get(`/worker/instructions${qs(params as Record<string, string | number | undefined>)}`),
};

// -----------------------------------------------------------------------------
// Sales
// -----------------------------------------------------------------------------

export const salesApi = {
  createEnquiry: (data: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    productName: string;
    quantity: number;
    remarks?: string;
  }) => post('/customer/enquiry', data),

  listEnquiries: (params?: ListParams) =>
    get<unknown[]>(`/customer/enquiry/list${qs(params as Record<string, string | number | undefined> || {})}`),

  generateQuotation: (data: {
    enquiryId?: string;
    customerName: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    validUntil?: string;
    remarks?: string;
  }) => post('/quotation/generate', data),

  listQuotations: (params?: ListParams) =>
    get<unknown[]>(`/quotation/list${qs(params as Record<string, string | number | undefined> || {})}`),

  confirmOrder: (data: {
    quotationId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    productName: string;
    quantity: number;
    totalAmount: number;
    expectedDelivery?: string;
    remarks?: string;
  }) => post('/order/confirm', data),

  listOrders: (params?: ListParams) =>
    get<unknown[]>(`/order/list${qs(params as Record<string, string | number | undefined> || {})}`),
};

// -----------------------------------------------------------------------------
// Reports
// -----------------------------------------------------------------------------

export const reportsApi = {
  dashboard: () => get<Record<string, unknown>>('/reports/dashboard'),

  monthly: (year?: number, month?: number) =>
    get(`/reports/monthly${qs({ year, month })}`),

  annual: (year?: number) =>
    get(`/reports/annual${qs({ year })}`),

  trends: (days?: number) =>
    get(`/reports/trends${qs({ days })}`),
};

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

export const auditApi = {
  list: (params?: ListParams) =>
    get<unknown[]>(`/audit/list${qs(params as Record<string, string | number | undefined> || {})}`),
};

// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------

export const healthApi = {
  check: () => get<{ status: string; timestamp: string; environment: string }>('/health'),
};
