import { Prisma } from '@prisma/client';
import prisma from '../config/database';

/**
 * Prisma transaction client type — accepts both the global client and a
 * transaction-scoped client returned by `prisma.$transaction(async (tx) => …)`.
 */
type PrismaTransactionClient = Prisma.TransactionClient;


/**
 * Generate sequential document numbers like PO-2024-001, ENQ-2024-001 etc.
 *
 * @param prefix  Short prefix for the document number (e.g. 'PO', 'REC').
 * @param model   Model name to count existing records against.
 * @param tx      Optional Prisma transaction client.  When called inside a
 *                `prisma.$transaction()` block you **must** pass the `tx`
 *                client so that counts include records created within the
 *                same transaction, preventing duplicate sequence numbers.
 */
export async function generateSequenceNumber(
  prefix: string,
  model: 'purchaseOrder' | 'supplierEnquiry' | 'supplierQuotation' | 'materialReceipt' | 'materialInspection' | 'materialBatch' | 'customerEnquiry' | 'customerQuotation' | 'customerOrder' | 'productionOrder',
  tx?: PrismaTransactionClient,
): Promise<string> {
  // Use the transaction client when available, otherwise fall back to global
  const db = tx ?? prisma;

  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  let count: number;

  // Count existing records for the current year based on model type
  switch (model) {
    case 'purchaseOrder':
      count = await db.purchaseOrder.count({
        where: { poNumber: { startsWith: yearPrefix } },
      });
      break;
    case 'supplierEnquiry':
      count = await db.supplierEnquiry.count({
        where: { enquiryNo: { startsWith: yearPrefix } },
      });
      break;
    case 'supplierQuotation':
      count = await db.supplierQuotation.count({
        where: { quotationNo: { startsWith: yearPrefix } },
      });
      break;
    case 'materialReceipt':
      count = await db.materialReceipt.count({
        where: { receiptNo: { startsWith: yearPrefix } },
      });
      break;
    case 'materialInspection':
      count = await db.materialInspection.count({
        where: { inspectionNo: { startsWith: yearPrefix } },
      });
      break;
    case 'materialBatch':
      count = await db.materialBatch.count({
        where: { batchNumber: { startsWith: yearPrefix } },
      });
      break;
    case 'customerEnquiry':
      count = await db.customerEnquiry.count({
        where: { enquiryNo: { startsWith: yearPrefix } },
      });
      break;
    case 'customerQuotation':
      count = await db.customerQuotation.count({
        where: { quotationNo: { startsWith: yearPrefix } },
      });
      break;
    case 'customerOrder':
      count = await db.customerOrder.count({
        where: { orderNo: { startsWith: yearPrefix } },
      });
      break;
    case 'productionOrder':
      count = await db.productionOrder.count({
        where: { orderNo: { startsWith: yearPrefix } },
      });
      break;
    default:
      count = 0;
  }

  const seq = String(count + 1).padStart(3, '0');
  return `${yearPrefix}${seq}`;
}
