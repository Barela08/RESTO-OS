# RESTO OS - Product Requirements Document (PRD)

## 1. Product Overview
- **Product Name:** RESTO OS
- **Full Form:** Restaurant Operations & Smart Table Ordering System
- **Category:** Full-Stack Restaurant Operating System / Cloud POS / Dynamic QR Table Management
- **Deployment:** Web Application (Responsive across Mobile, Tablet, and Desktop)
- **Primary Business Model:** Single Restaurant multi-role operations with complete database backing and strict Role-Based Access Control (RBAC).

## 2. Core Personas & System Roles
1. **Customer (Guest & Registered):**
   - Scans daily table QR token to access verified table session.
   - Browses menu by category with search, veg/non-veg filters, spicy levels, customizations.
   - Adds items to cart with live price calculation.
   - Places orders securely tied to the active table session.
   - Live order tracking (Placed → Accepted → Preparing → Ready → Served → Paid).
   - "Call Waiter" and "Request Bill" real-time assistance buttons.
   - Optional customer authentication (Phone/OTP) for digital stamp loyalty program.
2. **Waiter:**
   - Real-time dashboard showing assigned tables, active tickets, and customer requests.
   - Acknowledges call-waiter requests and marks them in progress/completed.
   - Receives instant notifications when kitchen marks tickets as READY.
   - Marks orders as SERVED.
3. **Kitchen Staff:**
   - Dedicated landscape-optimized Kitchen Display System (KDS).
   - Multi-station routing: Main Kitchen, Beverage Counter, Dessert Counter, Fast Food Counter.
   - Ticket progression: NEW (with audio chime) → ACCEPTED → PREPARING → READY → HANDED OVER.
   - Reason logging for any ticket rejection.
4. **Cash Counter Staff:**
   - Real-time active orders, pending bills, cash vs online collection.
   - Review and accept/reject Repeat QR Scan requests.
   - Cash payment collection: enter received cash, calculate change, confirm payment.
   - Consolidated billing for multiple rounds at the same table session.
   - Generates and prints official GST-compliant tax invoices.
5. **Restaurant Admin:**
   - Complete operational management: tables, daily dynamic QR code generation, menu items & categories, kitchen stations, staff accounts & table assignments, inventory & recipes.
6. **Restaurant Owner:**
   - Executive business intelligence: Gross sales, net sales, taxes, discounts, refunds, expenses, estimated net profit, average order value, peak ordering hours, waiter performance metrics, kitchen preparation speed, loyalty repeat rates.

## 3. High Priority Features & Business Rules
- **Daily Dynamic Table QR Codes:**
  - Generated once per restaurant calendar day per table.
  - Expire at 11:59:59 PM restaurant local time (default: Asia/Kolkata).
  - Cryptographically secure hash tokens; verified on server. Never trust table numbers from URL parameters.
  - Automatic detection of repeat scans on the same day triggering Counter verification.
- **Strict Financial & Payment Flow:**
  - Selecting "Pay at Cash Counter" NEVER auto-marks bill as paid. Requires authorized counter staff confirmation.
  - Server-calculated taxes (Indian GST: CGST + SGST breakdown).
  - Online UPI / Razorpay gateway integration with server-side webhook verification.
- **Digital Loyalty Program (Stamp System):**
  - Model: 1 stamp per eligible completed & paid order.
  - Cash orders earn stamp ONLY after cash counter confirmation.
  - Transparent reward unlocking (e.g. 8 stamps = 1 free reward voucher) with fraud prevention.
