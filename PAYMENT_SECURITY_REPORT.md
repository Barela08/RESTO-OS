# RESTO OS — PAYMENT SECURITY REPORT
**Cash Counter Integrity, UPI Reconciliation & Spark ₹0 Architectural Boundaries**  
**Date:** November 12, 2026  
**Target Architecture:** Firebase Spark Tier (₹0 Monthly Cost) & Counter POS

---

## 1. Spark ₹0 Plan Constraints & Architectural Boundaries

Firebase Spark Plan is a ₹0/month free tier that imposes specific boundaries:
- **No Cloud Functions:** Serverless background functions (Node.js backend execution) require the paid Firebase Blaze plan.
- **Client-to-Database Direct Model:** All client apps connect directly to Firestore and Realtime Database governed strictly by Firebase Security Rules.

### Security Implications for Online Payment Gateways (e.g. Razorpay)
1. **Never Expose Secret Keys in Client Bundles:** A standard online payment gateway requires verifying an HMAC-SHA256 signature using a private `RAZORPAY_KEY_SECRET`. Storing this secret inside a client-side Vite bundle allows any malicious user to extract the secret and forge signatures.
2. **Sanctioned Architecture for ₹0 Spark Tier:**
   - **Cash at Counter:** The customer requests cash settlement $\rightarrow$ cashier receives physical notes $\rightarrow$ cashier enters cash tendered $\rightarrow$ POS prints formal GST invoice.
   - **Dynamic Merchant UPI QR:** Customer scans the restaurant's merchant UPI QR $\rightarrow$ pays via GPay/PhonePe/Paytm $\rightarrow$ submits 12-digit bank UTR $\rightarrow$ cashier inspects bank statement/SMS and clicks "Approve UPI Payment" $\rightarrow$ invoice is issued.
   - **Online Gateway Integration (Card/NetBanking):** Requires a secure server-side boundary (e.g. Supabase Edge Functions / Vercel Serverless Function) where `RAZORPAY_KEY_SECRET` resides strictly in server environment variables. Client never possesses the gateway secret.

---

## 2. Cash Register & Change Calculation Security

In `src/services/databaseAdapter.ts` and `BillingRepository.ts`:
- **Change Calculation Formula:**
  $$\text{cashChangeAmount} = \max(0, \text{cashTenderedAmount} - \text{billAmount})$$
- **Underpayment Rejection:**
  If $\text{cashTenderedAmount} < \text{billAmount}$, the cashier POS blocks confirmation with `alert('Received cash amount is less than the bill total!')`.
- **Payment Idempotency:**
  Checking for existing `status == 'PAID'` records prevents cashier double-clicking from registering duplicate revenue.

---

## 3. Dynamic UPI Verification Workflow (Module 2.4 & 2.5)

```
Customer Smartphone              Customer UPI App             Cashier Terminal
┌─────────────────┐             ┌─────────────────┐          ┌─────────────────┐
│ Requests Bill   │             │ GPay / PhonePe  │          │ Cash Counter    │
│ (UPI Option)    │             │ Pays ₹1,260     │          │ Screen          │
└────────┬────────┘             └────────┬────────┘          └────────▲────────┘
         │                               │                            │
         │ Displays Merchant UPI QR      │ Generates Bank UTR         │ Displays Pending
         │ Customer enters 12-digit UTR  │ (e.g. 429381749201)        │ Verification
         └───────────────┬───────────────┴─────────┬──────────────────┘
                         │                         │
                         ▼                         │
           Submits Payment Verification            │ Cashier verifies in Bank
           Request to Firestore                    │ Statement & clicks Approve
                         │                         │
                         └─────────────────────────┘
```

### Security Rules for UPI Verification:
1. **Format Validation:** UTR must be an exact 12-digit numerical string (`^\d{12}$`).
2. **Duplicate Prevention:** Firestore rejects requests submitting a UTR that already exists for another approved invoice.
3. **Audit Trail:** Cashier staff ID (`st-ctr-1`) and confirmation timestamp are permanently affixed to the payment and invoice document.

---

## 4. GST Compliance & Invoice Security

- **Indian GST Composite Restaurant Slab:**
  - CGST: 2.5%
  - SGST: 2.5%
  - Total GST: 5.0%
- **Sequential Invoicing:** Every settled bill generates an immutable invoice record with format:
  $$\text{INV}-\text{YYYYMMDD}-\text{RANDOM4}$$
- **Anti-Tampering:** Once marked `PAID`, invoices cannot be edited or deleted by staff. Only authorized managers can issue partial or full refunds.
