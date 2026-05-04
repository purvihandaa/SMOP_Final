// =============================================================================
// SMOP Copilot — Tool Definitions & Executors
//
// Each tool wraps an existing SMOP backend service method so the LLM can
// retrieve live system data without direct database access.
//
// Uses OpenAI-compatible function-calling format (for NVIDIA NIM / DeepSeek).
// =============================================================================

import { reportsService } from '../reports/reports.service';
import { materialsService } from '../materials/materials.service';
import { manufacturingService } from '../manufacturing/manufacturing.service';
import { salesService } from '../sales/sales.service';
import { suppliersService } from '../suppliers/suppliers.service';
import { purchaseOrdersService } from '../purchaseOrders/purchaseOrders.service';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// -----------------------------------------------------------------------------
// OpenAI-compatible tool declarations
// -----------------------------------------------------------------------------

export const toolDeclarations: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_dashboard_kpis',
      description:
        'Get real-time dashboard KPIs: active purchase orders, pending inspections, total inventory items, low stock count, open customer orders, confirmed orders, total suppliers, and total materials.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inventory_overview',
      description:
        'Get current inventory stock levels with material names, codes, quantities, available quantities, reserved quantities, storage locations, and stock level thresholds. Can search by material name/code and filter by type.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by material name or code (optional)',
          },
          type: {
            type: 'string',
            description: 'Filter by inventory type: RAW, SEMI_FINISHED, or FINISHED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_materials_list',
      description:
        'Get the full list of registered materials with their IDs, names, codes, units, and types. Useful for looking up material details or checking what materials exist in the system.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_storage_locations',
      description:
        'Get all active storage locations (warehouses, zones, racks, bins) in the system.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_production_feasibility',
      description:
        'Check whether the system has enough raw materials to produce a given quantity of a product based on its Bill of Materials (BOM). Returns per-material availability, shortages, and the maximum producible quantity.',
      parameters: {
        type: 'object',
        properties: {
          bomId: {
            type: 'string',
            description: 'The BOM ID to check feasibility for. Use get_bom_list first to find the ID.',
          },
          quantity: {
            type: 'number',
            description: 'The number of product units to check feasibility for.',
          },
        },
        required: ['bomId', 'quantity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bom_list',
      description:
        'Get all Bills of Materials with their items, material details, and versions. Can filter by product name or status (DRAFT, ACTIVE, DEPRECATED).',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Filter by product name (optional, partial match)',
          },
          status: {
            type: 'string',
            description: 'Filter by BOM status: DRAFT, ACTIVE, or DEPRECATED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_purchase_orders',
      description:
        'Get a list of purchase orders with their status, supplier, amounts, and delivery dates. Can filter by status and search by PO number, supplier name, or material.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by PO number or supplier name (optional)',
          },
          status: {
            type: 'string',
            description:
              'Filter by PO status: DRAFT, PENDING_APPROVAL, APPROVED, SENT_TO_SUPPLIER, PARTIALLY_DELIVERED, DELIVERED, CLOSED, CANCELLED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_enquiries',
      description:
        'Get supplier enquiries with their status, supplier details, and requested materials. Can filter by status and search by enquiry number.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by enquiry number or supplier name (optional)',
          },
          status: {
            type: 'string',
            description: 'Filter by enquiry status: DRAFT, SENT, RESPONDED, CLOSED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_quotations',
      description:
        'Get supplier quotations with pricing, lead times, and approval status. Can filter by status.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by quotation number or supplier name (optional)',
          },
          status: {
            type: 'string',
            description: 'Filter by status: RECEIVED, UNDER_REVIEW, APPROVED, REJECTED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_orders',
      description:
        'Get customer orders with their status, product, quantity, amount, and customer details. Can filter by status and search by order number or customer name.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by order number, customer name, or product name (optional)',
          },
          status: {
            type: 'string',
            description:
              'Filter by order status: CONFIRMED, IN_PRODUCTION, READY_TO_DISPATCH, DISPATCHED, DELIVERED, CANCELLED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_enquiries',
      description:
        'Get customer enquiries with status, customer info, and requested product details.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search by enquiry number, customer, or product name (optional)',
          },
          status: {
            type: 'string',
            description: 'Filter by status: NEW, IN_PROGRESS, QUOTED, CLOSED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_report',
      description:
        'Get a monthly operational/financial summary including POs created, POs delivered, receipts count, inspections count, confirmed orders, total PO value, and total sales value.',
      parameters: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: 'Year for the report (defaults to current year)',
          },
          month: {
            type: 'number',
            description: 'Month for the report, 1-12 (defaults to current month)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_material_receipts',
      description:
        'Get material receipt records with batch details, inspection results, and associated purchase orders.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by receipt status: PENDING_INSPECTION or INSPECTED (optional)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_worker_instructions',
      description:
        'Get manufacturing worker instructions including active processes, BOMs, and production orders overview.',
      parameters: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Get instructions for a specific process (optional)',
          },
          bomId: {
            type: 'string',
            description: 'Get instructions for a specific BOM (optional)',
          },
        },
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Tool Executor — runs the tool against real services
// -----------------------------------------------------------------------------

const DEFAULT_PAGINATION = { page: 1, limit: 50, skip: 0 };

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  switch (name) {
    // ── Dashboard ──────────────────────────────────────────────────────────
    case 'get_dashboard_kpis':
      return reportsService.getDashboard();

    // ── Inventory ──────────────────────────────────────────────────────────
    case 'get_inventory_overview': {
      const result = await materialsService.viewInventory(DEFAULT_PAGINATION, {
        search: args.search as string | undefined,
        type: args.type as string | undefined,
      });
      return result;
    }

    case 'get_materials_list':
      return materialsService.listMaterials();

    case 'get_storage_locations':
      return materialsService.listLocations();

    case 'get_material_receipts': {
      const result = await materialsService.listReceipts(DEFAULT_PAGINATION, {
        status: args.status as string | undefined,
      });
      return result;
    }

    // ── Manufacturing ─────────────────────────────────────────────────────
    case 'check_production_feasibility':
      return manufacturingService.analyzeFeasibility(
        { bomId: args.bomId as string, quantity: args.quantity as number },
        userId,
      );

    case 'get_bom_list':
      return manufacturingService.viewBOMs({
        productName: args.productName as string | undefined,
        status: args.status as string | undefined,
      });

    case 'get_worker_instructions':
      return manufacturingService.getWorkerInstructions({
        processId: args.processId as string | undefined,
        bomId: args.bomId as string | undefined,
      });

    // ── Procurement ───────────────────────────────────────────────────────
    case 'get_purchase_orders': {
      const result = await purchaseOrdersService.listPurchaseOrders(DEFAULT_PAGINATION, {
        search: args.search as string | undefined,
        status: args.status as string | undefined,
      });
      return result;
    }

    case 'get_supplier_enquiries': {
      const result = await suppliersService.listEnquiries(DEFAULT_PAGINATION, {
        search: args.search as string | undefined,
        status: args.status as string | undefined,
      });
      return result;
    }

    case 'get_supplier_quotations': {
      const result = await suppliersService.listQuotations(DEFAULT_PAGINATION, {
        search: args.search as string | undefined,
        status: args.status as string | undefined,
      });
      return result;
    }

    // ── Sales ─────────────────────────────────────────────────────────────
    case 'get_customer_orders': {
      const result = await salesService.listOrders(DEFAULT_PAGINATION, {
        search: args.search as string | undefined,
        status: args.status as string | undefined,
      });
      return result;
    }

    case 'get_customer_enquiries': {
      const result = await salesService.listCustomerEnquiries(DEFAULT_PAGINATION, {
        search: args.search as string | undefined,
        status: args.status as string | undefined,
      });
      return result;
    }

    // ── Reports ───────────────────────────────────────────────────────────
    case 'get_monthly_report':
      return reportsService.getMonthlyReport(
        args.year as number | undefined,
        args.month as number | undefined,
      );

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
