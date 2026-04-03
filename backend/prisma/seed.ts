import { PrismaClient, UserRole, InventoryType, BOMStatus, PurchaseOrderStatus, EnquiryStatus, QuotationStatus, CustomerOrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // =========================================================================
  // 1. USERS
  // =========================================================================
  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        email: 'admin@speedage.com',
        password: hashedPassword,
        fullName: 'System Administrator',
        role: UserRole.ADMINISTRATOR,
      },
    }),
    prisma.user.upsert({
      where: { username: 'rajesh.purchase' },
      update: {},
      create: {
        username: 'rajesh.purchase',
        email: 'rajesh@speedage.com',
        password: hashedPassword,
        fullName: 'Rajesh Kumar',
        role: UserRole.PURCHASE_HANDLER,
      },
    }),
    prisma.user.upsert({
      where: { username: 'sunil.stores' },
      update: {},
      create: {
        username: 'sunil.stores',
        email: 'sunil@speedage.com',
        password: hashedPassword,
        fullName: 'Sunil Sharma',
        role: UserRole.STORES_HANDLER,
      },
    }),
    prisma.user.upsert({
      where: { username: 'priya.mfg' },
      update: {},
      create: {
        username: 'priya.mfg',
        email: 'priya@speedage.com',
        password: hashedPassword,
        fullName: 'Priya Nair',
        role: UserRole.MANUFACTURING_SUPERVISOR,
      },
    }),
    prisma.user.upsert({
      where: { username: 'amit.worker' },
      update: {},
      create: {
        username: 'amit.worker',
        email: 'amit@speedage.com',
        password: hashedPassword,
        fullName: 'Amit Patel',
        role: UserRole.MANUFACTURING_WORKER,
      },
    }),
    prisma.user.upsert({
      where: { username: 'neha.sales' },
      update: {},
      create: {
        username: 'neha.sales',
        email: 'neha@speedage.com',
        password: hashedPassword,
        fullName: 'Neha Gupta',
        role: UserRole.SALES_HANDLER,
      },
    }),
    prisma.user.upsert({
      where: { username: 'vikram.mgmt' },
      update: {},
      create: {
        username: 'vikram.mgmt',
        email: 'vikram@speedage.com',
        password: hashedPassword,
        fullName: 'Vikram Singh',
        role: UserRole.MANAGEMENT,
      },
    }),
  ]);

  const [adminUser, purchaseUser, storesUser, mfgUser, , salesUser] = users;
  console.log(`  ✅ Created ${users.length} users`);

  // =========================================================================
  // 2. SUPPLIERS
  // =========================================================================
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { id: 'sup-steel-corp' },
      update: {},
      create: {
        id: 'sup-steel-corp',
        name: 'Steel Corp Ltd',
        contactPerson: 'Arun Mehta',
        email: 'sales@steelcorp.in',
        phone: '+91-9876543210',
        address: 'Plot 45, Industrial Area, Ludhiana, Punjab',
        gstNumber: '03AABCS1234A1Z5',
        rating: 4.5,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-allied-metals' },
      update: {},
      create: {
        id: 'sup-allied-metals',
        name: 'Allied Metals',
        contactPerson: 'Ravi Verma',
        email: 'info@alliedmetals.co.in',
        phone: '+91-9876543211',
        address: '12/A, MIDC Bhosari, Pune, Maharashtra',
        gstNumber: '27AABCA5678B1Z3',
        rating: 4.2,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-rawmat-india' },
      update: {},
      create: {
        id: 'sup-rawmat-india',
        name: 'RawMat India',
        contactPerson: 'Kavita Joshi',
        email: 'procurement@rawmat.in',
        phone: '+91-9876543212',
        address: 'Sector 62, Noida, Uttar Pradesh',
        gstNumber: '09AABCR9012C1Z1',
        rating: 4.0,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-bharat-alloys' },
      update: {},
      create: {
        id: 'sup-bharat-alloys',
        name: 'Bharat Alloys',
        contactPerson: 'Deepak Rao',
        email: 'sales@bharatalloys.com',
        phone: '+91-9876543213',
        address: 'Jigani Industrial Area, Bengaluru, Karnataka',
        gstNumber: '29AABCB3456D1Z9',
        rating: 3.8,
      },
    }),
  ]);
  console.log(`  ✅ Created ${suppliers.length} suppliers`);

  // =========================================================================
  // 3. MATERIALS
  // =========================================================================
  const materials = await Promise.all([
    prisma.material.upsert({
      where: { code: 'MS-SHEET-001' },
      update: {},
      create: {
        code: 'MS-SHEET-001',
        name: 'Mild Steel Sheets',
        description: '2mm thick mild steel sheets for body fabrication',
        unit: 'pcs',
        type: InventoryType.RAW,
        hsnCode: '7208',
      },
    }),
    prisma.material.upsert({
      where: { code: 'AL-ROD-002' },
      update: {},
      create: {
        code: 'AL-ROD-002',
        name: 'Aluminum Rods',
        description: '10mm diameter aluminum rods',
        unit: 'kg',
        type: InventoryType.RAW,
        hsnCode: '7604',
      },
    }),
    prisma.material.upsert({
      where: { code: 'CU-WIRE-003' },
      update: {},
      create: {
        code: 'CU-WIRE-003',
        name: 'Copper Wire',
        description: '1.5mm enameled copper wire for motor windings',
        unit: 'm',
        type: InventoryType.RAW,
        hsnCode: '7408',
      },
    }),
    prisma.material.upsert({
      where: { code: 'SS-PIPE-004' },
      update: {},
      create: {
        code: 'SS-PIPE-004',
        name: 'Stainless Steel Pipes',
        description: '25mm diameter SS304 pipes',
        unit: 'pcs',
        type: InventoryType.RAW,
        hsnCode: '7306',
      },
    }),
    prisma.material.upsert({
      where: { code: 'PL-GRAN-005' },
      update: {},
      create: {
        code: 'PL-GRAN-005',
        name: 'Plastic Granules',
        description: 'ABS plastic granules for injection molding',
        unit: 'kg',
        type: InventoryType.RAW,
        hsnCode: '3901',
      },
    }),
    prisma.material.upsert({
      where: { code: 'BEARING-006' },
      update: {},
      create: {
        code: 'BEARING-006',
        name: 'Ball Bearings 6205',
        description: '25x52x15mm deep groove ball bearings',
        unit: 'pcs',
        type: InventoryType.RAW,
        hsnCode: '8482',
      },
    }),
    prisma.material.upsert({
      where: { code: 'MAGNET-007' },
      update: {},
      create: {
        code: 'MAGNET-007',
        name: 'Neodymium Magnets',
        description: 'N35 grade permanent magnets for motor assemblies',
        unit: 'pcs',
        type: InventoryType.RAW,
        hsnCode: '8505',
      },
    }),
  ]);
  console.log(`  ✅ Created ${materials.length} materials`);

  // =========================================================================
  // 4. STORAGE LOCATIONS
  // =========================================================================
  const locations = await Promise.all([
    prisma.storageLocation.upsert({
      where: { name: 'Warehouse A' },
      update: {},
      create: { name: 'Warehouse A', zone: 'A', rack: 'R1', bin: 'B1', description: 'Main raw materials warehouse', capacity: 10000 },
    }),
    prisma.storageLocation.upsert({
      where: { name: 'Warehouse B' },
      update: {},
      create: { name: 'Warehouse B', zone: 'B', rack: 'R1', bin: 'B1', description: 'Secondary storage', capacity: 5000 },
    }),
    prisma.storageLocation.upsert({
      where: { name: 'Warehouse C' },
      update: {},
      create: { name: 'Warehouse C', zone: 'C', rack: 'R1', bin: 'B1', description: 'Specialty materials', capacity: 3000 },
    }),
    prisma.storageLocation.upsert({
      where: { name: 'Default Warehouse' },
      update: {},
      create: { name: 'Default Warehouse', zone: 'D', description: 'Default receiving location', capacity: 20000 },
    }),
  ]);
  console.log(`  ✅ Created ${locations.length} storage locations`);

  // =========================================================================
  // 5. INVENTORY
  // =========================================================================
  const inventoryData = [
    { materialCode: 'MS-SHEET-001', locationName: 'Warehouse A', quantity: 450, minStock: 100, maxStock: 1000 },
    { materialCode: 'AL-ROD-002', locationName: 'Warehouse B', quantity: 180, minStock: 50, maxStock: 500 },
    { materialCode: 'CU-WIRE-003', locationName: 'Warehouse A', quantity: 800, minStock: 200, maxStock: 1500 },
    { materialCode: 'SS-PIPE-004', locationName: 'Warehouse C', quantity: 50, minStock: 30, maxStock: 300 },
    { materialCode: 'PL-GRAN-005', locationName: 'Warehouse B', quantity: 2000, minStock: 500, maxStock: 5000 },
    { materialCode: 'BEARING-006', locationName: 'Warehouse A', quantity: 300, minStock: 50, maxStock: 1000 },
    { materialCode: 'MAGNET-007', locationName: 'Warehouse A', quantity: 150, minStock: 30, maxStock: 500 },
  ];

  for (const inv of inventoryData) {
    const mat = materials.find(m => m.code === inv.materialCode)!;
    const loc = locations.find(l => l.name === inv.locationName)!;

    await prisma.inventory.upsert({
      where: {
        materialId_locationId: { materialId: mat.id, locationId: loc.id },
      },
      update: { quantity: inv.quantity, availableQty: inv.quantity },
      create: {
        materialId: mat.id,
        locationId: loc.id,
        quantity: inv.quantity,
        availableQty: inv.quantity,
        minStockLevel: inv.minStock,
        maxStockLevel: inv.maxStock,
        reorderPoint: inv.minStock * 1.5,
      },
    });
  }
  console.log(`  ✅ Created ${inventoryData.length} inventory records`);

  // =========================================================================
  // 6. ALERT THRESHOLDS
  // =========================================================================
  for (const mat of materials) {
    await prisma.alertThreshold.upsert({
      where: { materialId: mat.id },
      update: {},
      create: {
        materialId: mat.id,
        minStock: mat.code === 'SS-PIPE-004' ? 30 : 50,
        maxStock: mat.code === 'PL-GRAN-005' ? 5000 : 1000,
        severity: mat.code === 'SS-PIPE-004' ? 'HIGH' : 'MEDIUM',
      },
    });
  }
  console.log(`  ✅ Created alert thresholds for ${materials.length} materials`);

  // =========================================================================
  // 7. BOMs
  // =========================================================================
  const bom500W = await prisma.bOM.upsert({
    where: { productName_version: { productName: 'Speed Motor 500W', version: 1 } },
    update: {},
    create: {
      name: 'BOM - Speed Motor 500W v1',
      productName: 'Speed Motor 500W',
      version: 1,
      status: BOMStatus.ACTIVE,
      description: 'Bill of materials for 500W industrial motor assembly',
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'MS-SHEET-001')!.id, quantity: 5, unit: 'pcs' },
          { materialId: materials.find(m => m.code === 'CU-WIRE-003')!.id, quantity: 50, unit: 'm' },
          { materialId: materials.find(m => m.code === 'PL-GRAN-005')!.id, quantity: 2, unit: 'kg' },
          { materialId: materials.find(m => m.code === 'BEARING-006')!.id, quantity: 2, unit: 'pcs' },
          { materialId: materials.find(m => m.code === 'MAGNET-007')!.id, quantity: 4, unit: 'pcs' },
        ],
      },
    },
  });

  const bom1000W = await prisma.bOM.upsert({
    where: { productName_version: { productName: 'Speed Motor 1000W', version: 1 } },
    update: {},
    create: {
      name: 'BOM - Speed Motor 1000W v1',
      productName: 'Speed Motor 1000W',
      version: 1,
      status: BOMStatus.ACTIVE,
      description: 'Bill of materials for 1000W high-power motor assembly',
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'MS-SHEET-001')!.id, quantity: 8, unit: 'pcs' },
          { materialId: materials.find(m => m.code === 'CU-WIRE-003')!.id, quantity: 100, unit: 'm' },
          { materialId: materials.find(m => m.code === 'AL-ROD-002')!.id, quantity: 3, unit: 'kg' },
          { materialId: materials.find(m => m.code === 'BEARING-006')!.id, quantity: 4, unit: 'pcs' },
          { materialId: materials.find(m => m.code === 'MAGNET-007')!.id, quantity: 8, unit: 'pcs' },
        ],
      },
    },
  });
  console.log('  ✅ Created 2 BOMs (Speed Motor 500W, Speed Motor 1000W)');

  // =========================================================================
  // 8. MANUFACTURING PROCESSES
  // =========================================================================
  await prisma.manufacturingProcess.upsert({
    where: { id: 'proc-motor-assembly' },
    update: {},
    create: {
      id: 'proc-motor-assembly',
      name: 'Motor Assembly Process',
      description: 'Standard assembly workflow for Speed Motor series',
      estimatedTime: 120,
      steps: [
        { stepNumber: 1, name: 'Stator Preparation', description: 'Cut and shape mild steel sheets for stator lamination', estimatedMinutes: 20, instructions: 'Use die-cutting machine with MS-SHEET template' },
        { stepNumber: 2, name: 'Winding', description: 'Wind copper wire on stator core', estimatedMinutes: 30, instructions: 'Follow winding diagram for specified motor variant' },
        { stepNumber: 3, name: 'Rotor Assembly', description: 'Assemble rotor with magnets and bearings', estimatedMinutes: 25, instructions: 'Press-fit bearings and glue magnets per specification' },
        { stepNumber: 4, name: 'Housing Assembly', description: 'Mount components in housing', estimatedMinutes: 20, instructions: 'Ensure proper alignment of stator and rotor' },
        { stepNumber: 5, name: 'Testing', description: 'Run electrical and performance tests', estimatedMinutes: 15, instructions: 'Test at rated voltage, check RPM, current draw, and temperature' },
        { stepNumber: 6, name: 'Finishing', description: 'Paint, label, and package', estimatedMinutes: 10, instructions: 'Apply protective coating, attach rating plate, box with foam packing' },
      ],
    },
  });
  console.log('  ✅ Created manufacturing process');

  // =========================================================================
  // 9. SAMPLE PURCHASE ORDERS
  // =========================================================================
  const po1 = await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-2024-001' },
    update: {},
    create: {
      poNumber: 'PO-2024-001',
      supplierId: suppliers[0].id,
      status: PurchaseOrderStatus.DELIVERED,
      totalAmount: 225000,
      approvedDate: new Date('2024-03-01'),
      deliveryDate: new Date('2024-03-15'),
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'MS-SHEET-001')!.id, quantity: 500, unitPrice: 450, totalPrice: 225000, receivedQty: 500 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-2024-002' },
    update: {},
    create: {
      poNumber: 'PO-2024-002',
      supplierId: suppliers[1].id,
      status: PurchaseOrderStatus.APPROVED,
      totalAmount: 64000,
      approvedDate: new Date('2024-03-10'),
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'AL-ROD-002')!.id, quantity: 200, unitPrice: 320, totalPrice: 64000 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-2024-003' },
    update: {},
    create: {
      poNumber: 'PO-2024-003',
      supplierId: suppliers[2].id,
      status: PurchaseOrderStatus.DELIVERED,
      totalAmount: 78000,
      approvedDate: new Date('2024-03-05'),
      deliveryDate: new Date('2024-03-18'),
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'CU-WIRE-003')!.id, quantity: 1000, unitPrice: 78, totalPrice: 78000, receivedQty: 1000 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-2024-004' },
    update: {},
    create: {
      poNumber: 'PO-2024-004',
      supplierId: suppliers[3].id,
      status: PurchaseOrderStatus.PENDING_APPROVAL,
      totalAmount: 95000,
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'SS-PIPE-004')!.id, quantity: 150, unitPrice: 633, totalPrice: 94950 },
        ],
      },
    },
  });
  console.log('  ✅ Created 4 sample purchase orders');

  // =========================================================================
  // 10. SAMPLE SUPPLIER ENQUIRIES
  // =========================================================================
  await prisma.supplierEnquiry.upsert({
    where: { enquiryNo: 'ENQ-2024-001' },
    update: {},
    create: {
      enquiryNo: 'ENQ-2024-001',
      supplierId: suppliers[0].id,
      status: EnquiryStatus.RESPONDED,
      sentDate: new Date('2024-02-15'),
      responseDate: new Date('2024-02-20'),
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'MS-SHEET-001')!.id, quantity: 500, unit: 'pcs' },
        ],
      },
    },
  });

  await prisma.supplierEnquiry.upsert({
    where: { enquiryNo: 'ENQ-2024-002' },
    update: {},
    create: {
      enquiryNo: 'ENQ-2024-002',
      supplierId: suppliers[1].id,
      status: EnquiryStatus.SENT,
      sentDate: new Date('2024-03-01'),
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'AL-ROD-002')!.id, quantity: 200, unit: 'kg' },
        ],
      },
    },
  });
  console.log('  ✅ Created 2 sample supplier enquiries');

  // =========================================================================
  // 11. SAMPLE SUPPLIER QUOTATIONS
  // =========================================================================
  await prisma.supplierQuotation.upsert({
    where: { quotationNo: 'SQ-2024-001' },
    update: {},
    create: {
      quotationNo: 'SQ-2024-001',
      supplierId: suppliers[0].id,
      status: QuotationStatus.APPROVED,
      totalAmount: 225000,
      leadTimeDays: 7,
      validUntil: new Date('2024-06-30'),
      createdById: purchaseUser.id,
      items: {
        create: [
          { materialId: materials.find(m => m.code === 'MS-SHEET-001')!.id, quantity: 500, unitPrice: 450, totalPrice: 225000 },
        ],
      },
    },
  });
  console.log('  ✅ Created sample supplier quotation');

  // =========================================================================
  // 12. SAMPLE CUSTOMER ORDERS
  // =========================================================================
  await prisma.customerOrder.upsert({
    where: { orderNo: 'ORD-2024-001' },
    update: {},
    create: {
      orderNo: 'ORD-2024-001',
      customerName: 'ABC Industries',
      customerEmail: 'procurement@abcindustries.com',
      productName: 'Speed Motor 500W',
      quantity: 50,
      totalAmount: 375000,
      status: CustomerOrderStatus.CONFIRMED,
      confirmedDate: new Date('2024-03-10'),
      expectedDelivery: new Date('2024-04-10'),
      createdById: salesUser.id,
    },
  });

  await prisma.customerOrder.upsert({
    where: { orderNo: 'ORD-2024-002' },
    update: {},
    create: {
      orderNo: 'ORD-2024-002',
      customerName: 'XYZ Enterprises',
      customerEmail: 'orders@xyzent.com',
      productName: 'Speed Motor 1000W',
      quantity: 20,
      totalAmount: 320000,
      status: CustomerOrderStatus.CONFIRMED,
      confirmedDate: new Date('2024-03-12'),
      createdById: salesUser.id,
    },
  });

  await prisma.customerOrder.upsert({
    where: { orderNo: 'ORD-2024-003' },
    update: {},
    create: {
      orderNo: 'ORD-2024-003',
      customerName: 'Delta Corp',
      productName: 'Speed Motor 500W',
      quantity: 100,
      totalAmount: 700000,
      status: CustomerOrderStatus.CONFIRMED,
      confirmedDate: new Date('2024-03-14'),
      createdById: salesUser.id,
    },
  });

  await prisma.customerOrder.upsert({
    where: { orderNo: 'ORD-2024-004' },
    update: {},
    create: {
      orderNo: 'ORD-2024-004',
      customerName: 'Global Tech',
      customerEmail: 'supply@globaltech.in',
      productName: 'Speed Motor 1000W',
      quantity: 30,
      totalAmount: 480000,
      status: CustomerOrderStatus.IN_PRODUCTION,
      confirmedDate: new Date('2024-03-15'),
      createdById: salesUser.id,
    },
  });
  console.log('  ✅ Created 4 sample customer orders');

  // =========================================================================
  // 13. BUFFER STOCK RULES
  // =========================================================================
  await prisma.bufferStockRule.upsert({
    where: { materialCode: 'CU-WIRE-003' },
    update: {},
    create: { materialCode: 'CU-WIRE-003', bufferPercentage: 15, bufferQuantity: 200, isActive: true },
  });
  await prisma.bufferStockRule.upsert({
    where: { materialCode: 'MS-SHEET-001' },
    update: {},
    create: { materialCode: 'MS-SHEET-001', bufferPercentage: 10, bufferQuantity: 100, isActive: true },
  });
  console.log('  ✅ Created buffer stock rules');

  // =========================================================================
  // 14. SAMPLE AUDIT LOGS
  // =========================================================================
  await prisma.auditLog.createMany({
    data: [
      { actorId: adminUser.id, action: 'LOGIN', entityType: 'User', entityId: adminUser.id, metadata: {} },
      { actorId: purchaseUser.id, action: 'CREATE_PO', entityType: 'PurchaseOrder', entityId: po1.id, metadata: { poNumber: 'PO-2024-001' } },
      { actorId: storesUser.id, action: 'RECORD_RECEIPT', entityType: 'MaterialReceipt', metadata: { poNumber: 'PO-2024-001' } },
      { actorId: mfgUser.id, action: 'CREATE_BOM', entityType: 'BOM', entityId: bom500W.id, metadata: { productName: 'Speed Motor 500W' } },
      { actorId: salesUser.id, action: 'CONFIRM_ORDER', entityType: 'CustomerOrder', metadata: { orderNo: 'ORD-2024-001', customer: 'ABC Industries' } },
    ],
    skipDuplicates: true,
  });
  console.log('  ✅ Created sample audit logs');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Demo Credentials (all passwords: password123):');
  console.log('  admin            / Administrator');
  console.log('  rajesh.purchase  / Purchase Handler');
  console.log('  sunil.stores     / Stores Handler');
  console.log('  priya.mfg        / Manufacturing Supervisor');
  console.log('  amit.worker      / Manufacturing Worker');
  console.log('  neha.sales       / Sales Handler');
  console.log('  vikram.mgmt      / Management');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
