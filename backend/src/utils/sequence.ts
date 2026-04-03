import prisma from '../config/database';

/**
 * Generate sequential document numbers like PO-2024-001, ENQ-2024-001 etc.
 */
export async function generateSequenceNumber(
  prefix: string,
  model: 'purchaseOrder' | 'supplierEnquiry' | 'supplierQuotation' | 'materialReceipt' | 'materialInspection' | 'materialBatch' | 'customerEnquiry' | 'customerQuotation' | 'customerOrder' | 'productionOrder',
): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  let count: number;

  // Count existing records for the current year based on model type
  switch (model) {
    case 'purchaseOrder':
      count = await prisma.purchaseOrder.count({
        where: { poNumber: { startsWith: yearPrefix } },
      });
      break;
    case 'supplierEnquiry':
      count = await prisma.supplierEnquiry.count({
        where: { enquiryNo: { startsWith: yearPrefix } },
      });
      break;
    case 'supplierQuotation':
      count = await prisma.supplierQuotation.count({
        where: { quotationNo: { startsWith: yearPrefix } },
      });
      break;
    case 'materialReceipt':
      count = await prisma.materialReceipt.count({
        where: { receiptNo: { startsWith: yearPrefix } },
      });
      break;
    case 'materialInspection':
      count = await prisma.materialInspection.count({
        where: { inspectionNo: { startsWith: yearPrefix } },
      });
      break;
    case 'materialBatch':
      count = await prisma.materialBatch.count({
        where: { batchNumber: { startsWith: yearPrefix } },
      });
      break;
    case 'customerEnquiry':
      count = await prisma.customerEnquiry.count({
        where: { enquiryNo: { startsWith: yearPrefix } },
      });
      break;
    case 'customerQuotation':
      count = await prisma.customerQuotation.count({
        where: { quotationNo: { startsWith: yearPrefix } },
      });
      break;
    case 'customerOrder':
      count = await prisma.customerOrder.count({
        where: { orderNo: { startsWith: yearPrefix } },
      });
      break;
    case 'productionOrder':
      count = await prisma.productionOrder.count({
        where: { orderNo: { startsWith: yearPrefix } },
      });
      break;
    default:
      count = 0;
  }

  const seq = String(count + 1).padStart(3, '0');
  return `${yearPrefix}${seq}`;
}
