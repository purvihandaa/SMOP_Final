import prisma from '../../config/database';
import { FeasibilityResult, MaterialFeasibility, ScenarioResult, InventoryImpact } from '../../types';
import { writeAuditLog } from '../../utils/auditLogger';
import { NotFoundError } from '../../utils/errors';
import { BOMStatus } from '@prisma/client';
import {
  CreateProcessInput,
  CreateBOMInput,
  FeasibilityAnalyzeInput,
  ScenarioInput,
} from './manufacturing.validator';

export class ManufacturingService {
  // =========================================================================
  // PROCESS MANAGEMENT
  // =========================================================================

  async createProcess(input: CreateProcessInput, userId: string) {
    const process = await prisma.manufacturingProcess.create({
      data: {
        name: input.name,
        description: input.description,
        steps: input.steps || [],
        estimatedTime: input.estimatedTime,
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'CREATE_PROCESS',
      entityType: 'ManufacturingProcess',
      entityId: process.id,
      metadata: { name: input.name },
    });

    return process;
  }

  // =========================================================================
  // BOM MANAGEMENT
  // =========================================================================

  async createBOM(input: CreateBOMInput, userId: string) {
    // Determine version — auto-increment if product already has BOMs
    const existingBOMs = await prisma.bOM.findMany({
      where: { productName: input.productName },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const version = existingBOMs.length > 0 ? existingBOMs[0].version + 1 : 1;

    const bom = await prisma.bOM.create({
      data: {
        name: input.name,
        productName: input.productName,
        version,
        status: BOMStatus.ACTIVE,
        description: input.description,
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
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true, type: true } },
          },
        },
      },
    });

    await writeAuditLog({
      actorId: userId,
      action: 'CREATE_BOM',
      entityType: 'BOM',
      entityId: bom.id,
      metadata: { name: input.name, productName: input.productName, version, itemCount: input.items.length },
    });

    return bom;
  }

  async viewBOMs(filters?: { productName?: string; status?: string }) {
    const where: any = {};
    if (filters?.productName) {
      where.productName = { contains: filters.productName, mode: 'insensitive' };
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return prisma.bOM.findMany({
      where,
      include: {
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true, type: true } },
          },
        },
      },
      orderBy: [{ productName: 'asc' }, { version: 'desc' }],
    });
  }

  // =========================================================================
  // FEASIBILITY ANALYSIS — Real business logic
  // =========================================================================

  async analyzeFeasibility(input: FeasibilityAnalyzeInput, userId: string): Promise<FeasibilityResult> {
    const bom = await prisma.bOM.findUnique({
      where: { id: input.bomId },
      include: {
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM', input.bomId);
    }

    // Get current available inventory for all materials in this BOM
    const materialIds = bom.items.map(item => item.materialId);

    const inventoryRecords = await prisma.inventory.groupBy({
      by: ['materialId'],
      where: { materialId: { in: materialIds } },
      _sum: { availableQty: true },
    });

    const inventoryMap = new Map<string, number>();
    for (const inv of inventoryRecords) {
      inventoryMap.set(inv.materialId, inv._sum.availableQty || 0);
    }

    // Compute feasibility per material
    const materials: MaterialFeasibility[] = [];
    let maxProducible = Infinity;

    for (const bomItem of bom.items) {
      const requiredQty = bomItem.quantity * input.quantity;
      const availableQty = inventoryMap.get(bomItem.materialId) || 0;
      const shortage = Math.max(0, requiredQty - availableQty);
      const isSufficient = availableQty >= requiredQty;

      // Calculate max producible from this material
      if (bomItem.quantity > 0) {
        const maxFromThisMaterial = Math.floor(availableQty / bomItem.quantity);
        maxProducible = Math.min(maxProducible, maxFromThisMaterial);
      }

      materials.push({
        materialId: bomItem.materialId,
        materialName: bomItem.material.name,
        materialCode: bomItem.material.code,
        unit: bomItem.material.unit,
        requiredQty,
        availableQty,
        shortage,
        isSufficient,
      });
    }

    if (maxProducible === Infinity) maxProducible = 0;

    const feasible = materials.every(m => m.isSufficient);

    const result: FeasibilityResult = {
      feasible,
      bomId: bom.id,
      productName: bom.productName,
      requestedQuantity: input.quantity,
      maxProducibleQuantity: maxProducible,
      materials,
    };

    // Log the analysis
    await writeAuditLog({
      actorId: userId,
      action: 'FEASIBILITY_ANALYSIS',
      entityType: 'BOM',
      entityId: bom.id,
      metadata: {
        productName: bom.productName,
        requestedQty: input.quantity,
        feasible,
        maxProducible,
      },
    });

    return result;
  }

  // =========================================================================
  // SCENARIO-BASED PLANNING
  // =========================================================================

  async runScenario(input: ScenarioInput, userId: string): Promise<ScenarioResult[]> {
    const bom = await prisma.bOM.findUnique({
      where: { id: input.bomId },
      include: {
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM', input.bomId);
    }

    const materialIds = bom.items.map(item => item.materialId);

    const inventoryRecords = await prisma.inventory.groupBy({
      by: ['materialId'],
      where: { materialId: { in: materialIds } },
      _sum: { availableQty: true },
    });

    const inventoryMap = new Map<string, number>();
    for (const inv of inventoryRecords) {
      inventoryMap.set(inv.materialId, inv._sum.availableQty || 0);
    }

    const results: ScenarioResult[] = [];

    for (const qty of input.quantities) {
      const materials: MaterialFeasibility[] = [];
      const inventoryImpact: InventoryImpact[] = [];
      let maxProducible = Infinity;

      for (const bomItem of bom.items) {
        const requiredQty = bomItem.quantity * qty;
        const availableQty = inventoryMap.get(bomItem.materialId) || 0;
        const shortage = Math.max(0, requiredQty - availableQty);
        const isSufficient = availableQty >= requiredQty;

        if (bomItem.quantity > 0) {
          const maxFromThis = Math.floor(availableQty / bomItem.quantity);
          maxProducible = Math.min(maxProducible, maxFromThis);
        }

        materials.push({
          materialId: bomItem.materialId,
          materialName: bomItem.material.name,
          materialCode: bomItem.material.code,
          unit: bomItem.material.unit,
          requiredQty,
          availableQty,
          shortage,
          isSufficient,
        });

        inventoryImpact.push({
          materialId: bomItem.materialId,
          materialName: bomItem.material.name,
          currentQty: availableQty,
          requiredQty,
          remainingQty: Math.max(0, availableQty - requiredQty),
        });
      }

      if (maxProducible === Infinity) maxProducible = 0;
      const feasible = materials.every(m => m.isSufficient);

      // Persist scenario run
      const scenarioRun = await prisma.scenarioRun.create({
        data: {
          bomId: bom.id,
          requestedQty: qty,
          feasible,
          maxProducible,
          resultData: JSON.parse(JSON.stringify({ materials, inventoryImpact })),
          createdById: userId,
        },
      });

      results.push({
        scenarioId: scenarioRun.id,
        feasible,
        bomId: bom.id,
        productName: bom.productName,
        requestedQuantity: qty,
        maxProducibleQuantity: maxProducible,
        materials,
        inventoryImpact,
      });
    }

    return results;
  }

  // =========================================================================
  // WORKER INSTRUCTIONS (read-only)
  // =========================================================================

  async getWorkerInstructions(filters?: { processId?: string; bomId?: string; orderId?: string }) {
    const instructions: any = {};

    if (filters?.processId) {
      const process = await prisma.manufacturingProcess.findUnique({
        where: { id: filters.processId },
      });
      if (process) {
        instructions.process = {
          name: process.name,
          description: process.description,
          estimatedTime: process.estimatedTime,
          steps: process.steps,
        };
      }
    }

    if (filters?.bomId) {
      const bom = await prisma.bOM.findUnique({
        where: { id: filters.bomId },
        include: {
          items: {
            include: {
              material: { select: { name: true, code: true, unit: true } },
            },
          },
        },
      });
      if (bom) {
        instructions.bom = {
          productName: bom.productName,
          version: bom.version,
          materials: bom.items.map(item => ({
            material: item.material.name,
            code: item.material.code,
            quantity: item.quantity,
            unit: item.unit,
            remarks: item.remarks,
          })),
        };
      }
    }

    if (filters?.orderId) {
      const order = await prisma.productionOrder.findUnique({
        where: { id: filters.orderId },
        include: {
          bom: {
            include: {
              items: {
                include: { material: { select: { name: true, code: true, unit: true } } },
              },
            },
          },
          process: true,
        },
      });
      if (order) {
        instructions.order = {
          orderNo: order.orderNo,
          quantity: order.quantity,
          status: order.status,
          plannedStart: order.plannedStart,
          plannedEnd: order.plannedEnd,
          product: order.bom.productName,
          materials: order.bom.items.map(item => ({
            material: item.material.name,
            code: item.material.code,
            quantityPerUnit: item.quantity,
            totalRequired: item.quantity * order.quantity,
            unit: item.unit,
          })),
          process: order.process ? {
            name: order.process.name,
            steps: order.process.steps,
          } : null,
        };
      }
    }

    // If no specific filter, return all active processes and BOMs overview
    if (!filters?.processId && !filters?.bomId && !filters?.orderId) {
      const [processes, boms, activeOrders] = await Promise.all([
        prisma.manufacturingProcess.findMany({
          where: { isActive: true },
          select: { id: true, name: true, description: true, estimatedTime: true },
        }),
        prisma.bOM.findMany({
          where: { status: BOMStatus.ACTIVE },
          select: { id: true, name: true, productName: true, version: true },
        }),
        prisma.productionOrder.findMany({
          where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
          select: { id: true, orderNo: true, quantity: true, status: true, plannedStart: true },
          orderBy: { plannedStart: 'asc' },
          take: 20,
        }),
      ]);

      instructions.processes = processes;
      instructions.boms = boms;
      instructions.activeOrders = activeOrders;
    }

    return instructions;
  }
}

export const manufacturingService = new ManufacturingService();
