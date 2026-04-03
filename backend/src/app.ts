import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import suppliersRoutes from './modules/suppliers/suppliers.routes';
import purchaseOrderRoutes from './modules/purchaseOrders/purchaseOrders.routes';
import materialRoutes from './modules/materials/materials.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import manufacturingRoutes from './modules/manufacturing/manufacturing.routes';
import salesRoutes from './modules/sales/sales.routes';
import reportsRoutes from './modules/reports/reports.routes';
import auditRoutes from './modules/audit/audit.routes';

const app = express();

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================

// CORS — allow frontend origin with credentials
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing (for JWT in HTTP-only cookies)
app.use(cookieParser());

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
    },
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchase-order', purchaseOrderRoutes);
app.use('/api/material', materialRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api', manufacturingRoutes);  // Mounts /api/process/*, /api/bom/*, /api/feasibility/*, /api/worker/*
app.use('/api', salesRoutes);          // Mounts /api/customer/*, /api/quotation/*, /api/order/*
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// ============================================================================
// ERROR HANDLER (must be last)
// ============================================================================

app.use(errorHandler);

export default app;
