# SMOP Backend — Speedage Manufacturing Operations Platform

Production-grade Express + TypeScript + Prisma + PostgreSQL backend for the SMOP manufacturing operations platform.

## Architecture

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema (30+ models, enums, indexes)
│   └── seed.ts                # Demo data (7 users, suppliers, materials, BOMs, orders)
├── src/
│   ├── config/                # Environment config & Prisma client singleton
│   ├── middleware/            # Auth, RBAC, validation, error handling
│   ├── modules/              # Feature modules (controller → service → prisma)
│   │   ├── auth/             # JWT login/logout/session
│   │   ├── suppliers/        # Enquiries & quotations
│   │   ├── purchaseOrders/   # PO lifecycle with state machine
│   │   ├── materials/        # Receipt, inspection, batch traceability
│   │   ├── inventory/        # View & location transfer
│   │   ├── manufacturing/    # Process, BOM, feasibility, scenarios
│   │   ├── sales/            # Customer enquiry, quotation, orders
│   │   ├── reports/          # Dashboard, monthly, annual, trends
│   │   └── audit/            # Audit log listing
│   ├── types/                # Shared TypeScript types
│   ├── utils/                # Response helpers, errors, audit logger, sequences
│   ├── app.ts                # Express app setup
│   └── server.ts             # Server entry point
├── tests/                    # Vitest + Supertest integration tests
├── .env.example              # Environment variable template
└── package.json
```

### Design Principles

- **Controller → Service → Prisma** separation: business logic lives in services
- **Transactional integrity**: inventory-affecting operations use `prisma.$transaction()`
- **State machine validation**: PO status transitions are explicitly validated
- **Real feasibility analysis**: computes max producible quantity from live inventory
- **Batch traceability**: supplier → PO → receipt → inspection → inventory chain
- **RBAC**: every endpoint restricted by user role
- **Audit logging**: critical actions recorded with actor, entity, and metadata

---

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **npm** or **yarn**

---

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your PostgreSQL connection string
# DATABASE_URL="postgresql://user:password@localhost:5432/smop_db"
```

### 3. Create database

```sql
-- In psql or pgAdmin:
CREATE DATABASE smop_db;
```

### 4. Generate Prisma client

```bash
npx prisma generate
```

### 5. Run migrations

```bash
npx prisma migrate dev --name init
```

### 6. Seed demo data

```bash
npm run prisma:seed
```

### 7. Start the server

```bash
npm run dev
```

The server starts at `http://localhost:3001`.

---

## Demo Credentials

All passwords: `password123`

| Username          | Role                      |
|-------------------|---------------------------|
| `admin`           | Administrator             |
| `rajesh.purchase` | Purchase Handler          |
| `sunil.stores`    | Stores Handler            |
| `priya.mfg`       | Manufacturing Supervisor  |
| `amit.worker`     | Manufacturing Worker      |
| `neha.sales`      | Sales Handler             |
| `vikram.mgmt`     | Management                |

---

## API Endpoints

### Auth
| Method | Path                | Description          |
|--------|---------------------|----------------------|
| POST   | `/api/auth/login`   | Login with username/password |
| POST   | `/api/auth/logout`  | Clear session cookie |
| GET    | `/api/auth/session` | Get current user     |

### Suppliers
| Method | Path                            | Description          |
|--------|---------------------------------|----------------------|
| GET    | `/api/suppliers/list`           | List all suppliers   |
| POST   | `/api/suppliers/enquiry/create` | Create supplier enquiry |
| GET    | `/api/suppliers/enquiry/list`   | List enquiries       |
| POST   | `/api/suppliers/quotation/add`  | Record quotation     |
| GET    | `/api/suppliers/quotation/list` | List quotations      |

### Purchase Orders
| Method | Path                                | Description          |
|--------|-------------------------------------|----------------------|
| POST   | `/api/purchase-order/create`        | Create PO            |
| GET    | `/api/purchase-order/list`          | List POs             |
| PUT    | `/api/purchase-order/update-status` | Update PO status     |

### Materials & Inventory
| Method | Path                          | Description            |
|--------|-------------------------------|------------------------|
| POST   | `/api/material/receipt`       | Record material receipt |
| POST   | `/api/material/inspection`    | Record inspection      |
| POST   | `/api/material/batch/create`  | Create batch           |
| GET    | `/api/material/list`          | List materials         |
| GET    | `/api/material/locations`     | List storage locations |
| GET    | `/api/inventory/view`         | View inventory         |
| PUT    | `/api/inventory/update-location` | Transfer material   |

### Manufacturing
| Method | Path                          | Description            |
|--------|-------------------------------|------------------------|
| POST   | `/api/process/create`         | Define process         |
| POST   | `/api/bom/create`             | Create BOM             |
| GET    | `/api/bom/view`               | List BOMs              |
| POST   | `/api/feasibility/analyze`    | Feasibility analysis   |
| POST   | `/api/feasibility/scenario`   | Scenario planning      |
| GET    | `/api/worker/instructions`    | Worker instructions    |

### Sales
| Method | Path                      | Description            |
|--------|---------------------------|------------------------|
| POST   | `/api/customer/enquiry`   | Customer enquiry       |
| POST   | `/api/quotation/generate` | Generate quotation     |
| POST   | `/api/order/confirm`      | Confirm order          |
| GET    | `/api/order/list`         | List orders            |

### Reports
| Method | Path                     | Description            |
|--------|--------------------------|------------------------|
| GET    | `/api/reports/dashboard` | Dashboard KPIs         |
| GET    | `/api/reports/monthly`   | Monthly report         |
| GET    | `/api/reports/annual`    | Annual report          |
| GET    | `/api/reports/trends`    | Activity trends        |

### Audit
| Method | Path               | Description            |
|--------|--------------------|------------------------|
| GET    | `/api/audit/list`  | Audit log listing      |

### Health
| Method | Path            | Description            |
|--------|-----------------|------------------------|
| GET    | `/api/health`   | Health check           |

---

## API Response Format

All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Additional details"
}
```

---

## Sample Requests

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123"}' \
  -c cookies.txt
```

### Create Supplier Enquiry
```bash
curl -X POST http://localhost:3001/api/suppliers/enquiry/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "supplierId": "sup-steel-corp",
    "items": [
      {"materialId": "<MS-SHEET-ID>", "quantity": 500, "unit": "pcs"}
    ]
  }'
```

### Feasibility Analysis
```bash
curl -X POST http://localhost:3001/api/feasibility/analyze \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"bomId": "<BOM-ID>", "quantity": 100}'
```

Response:
```json
{
  "success": true,
  "data": {
    "feasible": false,
    "productName": "Speed Motor 500W",
    "requestedQuantity": 100,
    "maxProducibleQuantity": 16,
    "materials": [
      {
        "materialName": "Copper Wire",
        "requiredQty": 5000,
        "availableQty": 800,
        "shortage": 4200,
        "isSufficient": false
      }
    ]
  }
}
```

---

## Running Tests

```bash
npm test
```

---

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled production build |
| `npm test` | Run tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed database |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run prisma:reset` | Reset database (drop + migrate + seed) |

---

## Assumptions & Decisions

1. **Cookie-based auth**: JWT stored in HTTP-only cookie `smop_token` for security against XSS — frontend calls are made with `credentials: 'include'`
2. **Single-plant**: Schema designed for single plant; `plantId` can be added later for multi-plant expansion
3. **Soft delete**: Not applied globally — only where business justification exists (users). Most entities use status-based lifecycle
4. **Sequence numbers**: Generated as `PREFIX-YEAR-SEQUENCE` (e.g., `PO-2024-001`), using count-based approach suitable for single-instance deployment
5. **Feasibility analysis**: Aggregates available inventory across all locations per material — computes max producible quantity
6. **Default warehouse**: Material receipts land in a "Default Warehouse" location if no specific location is specified
7. **CORS**: Configured for `localhost:8080` (Vite dev server) — update `CORS_ORIGIN` for production
