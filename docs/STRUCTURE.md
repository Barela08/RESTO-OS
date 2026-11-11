# RESTO OS - Codebase Structure Specification

```
resto-os/
│
├── public/
│   ├── favicon.ico
│   └── sounds/
│
├── src/
│   ├── app/
│   │   ├── router/          # React Router 7 / 6 with protected guards
│   │   ├── guards/          # RoleBasedGuard, CustomerSessionGuard
│   │   └── providers/       # AuthProvider, RestoDataProvider, NotificationProvider
│   │
│   ├── components/
│   │   ├── ui/              # Badges, Buttons, Modals, Inputs, Tabs, Skeletons
│   │   ├── common/          # Header, Sidebar, AudioAlert, PrintableInvoice, QRCard
│   │   └── layout/          # AdminLayout, StaffLayout, CustomerLayout
│   │
│   ├── modules/
│   │   ├── customer/        # QR Landing, Menu, Cart, OrderTracker, BillPayment, Loyalty
│   │   ├── waiter/          # Assigned Tables, Active Orders, Waiter Calls
│   │   ├── kitchen/         # KDS Display, Ticket Pipeline, Multi-Station Routing
│   │   ├── counter/         # Cash Counter, Pending Bills, Repeat Scan Confirmations
│   │   ├── admin/           # Tables, Daily QR Manager, Menu Editor, Inventory, Staff
│   │   └── owner/           # Executive Analytics, Revenue, Net Profit, Peak Hours
│   │
│   ├── services/
│   │   ├── supabase.ts      # Supabase Client connection
│   │   ├── databaseAdapter.ts # Unified data provider: Live Supabase + local failover store
│   │   ├── qrService.ts     # SHA-256 daily QR generation and verification
│   │   ├── audioService.ts  # Web Audio synthetic alerts for kitchen/counter
│   │   ├── pdfService.ts    # Official Tax Invoice PDF generator
│   │   └── loyaltyService.ts # Stamp issuance and voucher redemption
│   │
│   ├── store/
│   │   ├── authStore.ts     # Active user, staff role, profile state
│   │   ├── sessionStore.ts  # Active table session, verified table metadata
│   │   └── cartStore.ts     # Customer cart, item customizations, subtotal
│   │
│   ├── types/
│   │   └── index.ts         # Comprehensive TypeScript interfaces for all entities
│   │
│   └── utils/
│       ├── currency.ts      # ₹ currency formatter
│       ├── date.ts          # IST timezone date formatters
│       └── cn.ts            # Classnames merger
│
├── supabase/
│   ├── migrations/          # 000001 (Schema), 000002 (RLS), 000003 (RPCs & Triggers)
│   └── seed.sql             # Real restaurant, tables, QRs, staff, menu & orders
│
├── docs/                    # Complete Architecture, PRD, API, Security, Testing docs
├── .env.example
├── package.json
└── README.md
```
