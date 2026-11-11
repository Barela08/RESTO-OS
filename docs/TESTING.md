# RESTO OS - Testing Protocol & Test Plan

## 1. Test Matrix Overview
This document outlines the test requirements specified in PART 25 of the Master Specification.

### 1.1 QR Tests
| Test Case ID | Description | Expected Outcome |
|---|---|---|
| QR-01 | First daily scan of valid table QR | Resolves table, creates active session, updates table to OCCUPIED |
| QR-02 | Expired QR token scan (past 23:59:59) | Returns EXPIRED_TOKEN error; blocks ordering |
| QR-03 | Revoked QR token scan | Returns REVOKED_TOKEN error |
| QR-04 | URL parameter tampering (changing table number) | Blocked; server verifies token hash only |
| QR-05 | Repeat scan on same day with active session | Raises repeat scan alert to Cash Counter; holds session |
| QR-06 | Counter approval of repeat scan | Reconnects authorized session; permits additional food orders |

### 1.2 Order & Kitchen Tests
| Test Case ID | Description | Expected Outcome |
|---|---|---|
| ORD-01 | Order placement with valid session | Re-prices items from DB, adds GST, assigns waiter, generates order number |
| ORD-02 | Multi-station ticket routing | Splits items between Main Kitchen, Beverage Bar, Pizza Oven |
| ORD-03 | KDS ticket progression | NEW (Audio alert) → ACCEPTED → PREPARING → READY |
| ORD-04 | Ready order notification | Chime and alert sent to assigned waiter |
| ORD-05 | Waiter serving food | Transitions order to SERVED; updates customer order tracking |

### 1.3 Counter & Payment Tests
| Test Case ID | Description | Expected Outcome |
|---|---|---|
| PAY-01 | "Pay at Counter" selected by customer | Bill status set to PAYMENT_PENDING; NOT marked paid |
| PAY-02 | Counter cash confirmation | Staff enters amount, validates change, marks PAID, emits invoice |
| PAY-03 | Online UPI checkout | Simulated/Live gateway verification; marks PAID upon confirmation |
| PAY-04 | Consolidated bill calculation | Multiple orders in the same session combined into 1 invoice without double-counting |

### 1.4 Loyalty Stamp Tests
| Test Case ID | Description | Expected Outcome |
|---|---|---|
| LOY-01 | Unregistered guest completes paid order | No stamp issued; prompted to enter phone to claim |
| LOY-02 | Registered member completes paid order >= ₹250 | Exactly 1 stamp awarded to loyalty account |
| LOY-03 | Duplicate stamp attempt on same order | Blocked by UNIQUE(order_id) database constraint |
| LOY-04 | Reaching 8 stamps milestone | 8 stamps deducted; complimentary voucher generated with expiry |
