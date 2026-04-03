import prisma from '../../config/database';
import {
  PurchaseOrderStatus,
  CustomerOrderStatus,
  InventoryType,
} from '@prisma/client';

export class ReportsService {
  /**
   * Dashboard KPIs — aggregated counts and summaries
   */
  async getDashboard() {
    const [
      activePOs,
      pendingInspections,
      totalInventoryItems,
      lowStockItems,
      openOrders,
      confirmedOrders,
      totalSuppliers,
      totalMaterials,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.purchaseOrder.count({
        where: { status: { in: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.SENT_TO_SUPPLIER, PurchaseOrderStatus.PARTIALLY_DELIVERED] } },
      }),
      prisma.materialReceipt.count({
        where: { status: 'PENDING_INSPECTION' },
      }),
      prisma.inventory.count(),
      prisma.inventory.count({
        where: {
          availableQty: { lte: prisma.inventory.fields.minStockLevel as any },
        },
      }).catch(() => 0), // Fallback if comparison fails
      prisma.customerOrder.count({
        where: { status: { in: [CustomerOrderStatus.CONFIRMED, CustomerOrderStatus.IN_PRODUCTION] } },
      }),
      prisma.customerOrder.count({
        where: { status: CustomerOrderStatus.CONFIRMED },
      }),
      prisma.supplier.count({ where: { isActive: true } }),
      prisma.material.count({ where: { isActive: true } }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true, role: true } } },
      }),
    ]);

    // Get inventory by type
    const inventoryByType = await prisma.inventory.groupBy({
      by: ['materialId'],
      _sum: { quantity: true, availableQty: true },
    });

    // Get low stock alerts
    const lowStockAlerts = await prisma.inventory.findMany({
      where: {
        minStockLevel: { gt: 0 },
      },
      include: {
        material: { select: { name: true, code: true, unit: true } },
        location: { select: { name: true } },
      },
      take: 10,
    });

    const alertItems = lowStockAlerts.filter(inv => inv.availableQty <= inv.minStockLevel);

    return {
      kpis: {
        activePOs,
        pendingInspections,
        totalInventoryItems,
        lowStockItems: alertItems.length,
        openOrders,
        confirmedOrders,
        totalSuppliers,
        totalMaterials,
      },
      recentActivity: recentAuditLogs.map(log => ({
        action: log.action,
        entityType: log.entityType,
        actor: log.actor?.fullName || 'System',
        timestamp: log.createdAt,
      })),
      alerts: alertItems.map(inv => ({
        material: inv.material.name,
        code: inv.material.code,
        currentQty: inv.availableQty,
        minLevel: inv.minStockLevel,
        location: inv.location.name,
        severity: inv.availableQty === 0 ? 'CRITICAL' : 'HIGH',
      })),
    };
  }

  /**
   * Monthly report — aggregated data for a given month/year
   */
  async getMonthlyReport(year?: number, month?: number) {
    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const [
      posCreated,
      posDelivered,
      receiptsCount,
      inspectionsCount,
      ordersConfirmed,
      totalPOValue,
      totalOrderValue,
    ] = await Promise.all([
      prisma.purchaseOrder.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.purchaseOrder.count({
        where: { deliveryDate: { gte: startDate, lte: endDate } },
      }),
      prisma.materialReceipt.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.materialInspection.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.customerOrder.count({
        where: { confirmedDate: { gte: startDate, lte: endDate } },
      }),
      prisma.purchaseOrder.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
      }),
      prisma.customerOrder.aggregate({
        where: { confirmedDate: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      period: { year: y, month: m, startDate, endDate },
      purchaseOrders: {
        created: posCreated,
        delivered: posDelivered,
        totalValue: totalPOValue._sum.totalAmount || 0,
      },
      materials: {
        receipts: receiptsCount,
        inspections: inspectionsCount,
      },
      sales: {
        ordersConfirmed,
        totalValue: totalOrderValue._sum.totalAmount || 0,
      },
    };
  }

  /**
   * Annual report — aggregated data for the year
   */
  async getAnnualReport(year?: number) {
    const y = year || new Date().getFullYear();
    const startDate = new Date(y, 0, 1);
    const endDate = new Date(y, 11, 31, 23, 59, 59);

    // Monthly breakdown
    const monthlyData = [];
    for (let month = 0; month < 12; month++) {
      const mStart = new Date(y, month, 1);
      const mEnd = new Date(y, month + 1, 0, 23, 59, 59);

      const [poCount, poValue, orderCount, orderValue] = await Promise.all([
        prisma.purchaseOrder.count({
          where: { createdAt: { gte: mStart, lte: mEnd } },
        }),
        prisma.purchaseOrder.aggregate({
          where: { createdAt: { gte: mStart, lte: mEnd } },
          _sum: { totalAmount: true },
        }),
        prisma.customerOrder.count({
          where: { confirmedDate: { gte: mStart, lte: mEnd } },
        }),
        prisma.customerOrder.aggregate({
          where: { confirmedDate: { gte: mStart, lte: mEnd } },
          _sum: { totalAmount: true },
        }),
      ]);

      monthlyData.push({
        month: month + 1,
        purchaseOrders: poCount,
        purchaseValue: poValue._sum.totalAmount || 0,
        customerOrders: orderCount,
        salesValue: orderValue._sum.totalAmount || 0,
      });
    }

    // Annual totals
    const [totalPOValue, totalSalesValue] = await Promise.all([
      prisma.purchaseOrder.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
      }),
      prisma.customerOrder.aggregate({
        where: { confirmedDate: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      year: y,
      totals: {
        purchaseValue: totalPOValue._sum.totalAmount || 0,
        salesValue: totalSalesValue._sum.totalAmount || 0,
      },
      monthly: monthlyData,
    };
  }

  /**
   * Trends — recent activity trends
   */
  async getTrends(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [poTrend, orderTrend, inventoryTransactions] = await Promise.all([
      prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.customerOrder.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: true,
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: startDate } },
        _count: true,
        _sum: { quantity: true },
      }),
    ]);

    // Top materials by transaction volume
    const topMaterials = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryId'],
      where: { createdAt: { gte: startDate } },
      _count: true,
      _sum: { quantity: true },
      orderBy: { _count: { inventoryId: 'desc' } },
      take: 10,
    });

    return {
      period: { days, from: startDate, to: new Date() },
      purchaseOrders: poTrend.map(item => ({
        status: item.status,
        count: item._count,
      })),
      customerOrders: orderTrend.map(item => ({
        status: item.status,
        count: item._count,
      })),
      inventoryActivity: inventoryTransactions.map(item => ({
        type: item.type,
        count: item._count,
        totalQuantity: item._sum.quantity || 0,
      })),
      topMaterialsByActivity: topMaterials.length,
    };
  }
}

export const reportsService = new ReportsService();
