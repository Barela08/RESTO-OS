# RESTO OS (Restaurant Operations & Smart Table Ordering System)

A production-ready, full-stack restaurant operating system and smart QR table ordering platform. Built with React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand, and Supabase PostgreSQL.

---

## Key Highlights

- **Daily Dynamic QR Codes:** System-generated cryptographically secure SHA-256 tokens per table that expire at 11:59:59 PM. Repeat scans trigger instant alerts to Cash Counter.
- **Customer Mobile Web Ordering:** Guest ordering, real-time verified table session, category browsing, item customizations, server-calculated Indian GST (CGST + SGST), live order tracker, "Call Waiter" and "Request Bill".
- **Kitchen Display System (KDS):** Multi-station routing (Main Kitchen, Beverage Bar, Dessert, Pizza Oven), live timers, sound chimes, ticket workflow: New → Accepted → Preparing → Ready.
- **Waiter Dashboard:** Assigned tables, order alerts, ready-to-serve chimes, mark served, customer assistance acknowledgement.
- **Cash Counter & Payments:** Pending bills, cash collection with change verification, UPI checkout flow, repeat scan approvals, consolidated table billing, GST-compliant printable tax invoices.
- **Digital Loyalty Stamp System:** 1 stamp per completed order >= ₹250. 8 stamps = 1 automatic reward voucher. Strict anti-fraud protections.
- **Admin & Owner Management:** Floor tables, daily QR bulk generation & printing, menu items & categories, kitchen stations, staff accounts & table assignments, inventory & recipes, executive analytics (gross revenue, GST, discounts, net profit, peak ordering hours).

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, React Router
- **State Management:** Zustand & TanStack Query
- **Backend & Database:** Supabase (PostgreSQL, Realtime, Row Level Security, RPC Functions)
- **Utilities:** QRCode, jsPDF, Web Audio API sound synthesizers, date-fns

---

## Quick Start

1. **Clone & Install Dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure Environment:**
   Create a `.env` file (refer to `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_DEFAULT_RESTAURANT_ID=rest-001-main
   ```

3. **Database Setup:**
   Execute migrations in `supabase/migrations/` and seed data in `supabase/seed.sql` inside your Supabase SQL editor.

4. **Run Development Server:**
   ```bash
   npm run dev
   ```

---

## Route Overview

| Role / Experience | Route |
|---|---|
| Customer QR Ordering | `/order?token=<daily_token>` or `/order` |
| Customer Order Tracking | `/order/track/:id` |
| Customer Payment | `/order/payment/:id` |
| Customer Loyalty & Rewards | `/my-rewards` |
| Staff Login | `/staff/login` |
| Admin Login | `/admin/login` |
| Admin Dashboard | `/admin` |
| Waiter Dashboard | `/waiter` |
| Kitchen Display (KDS) | `/kitchen` |
| Cash Counter / POS | `/counter` |
| Owner Analytics | `/owner` |
