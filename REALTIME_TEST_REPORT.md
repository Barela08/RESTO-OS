# RESTO OS — REALTIME TEST REPORT
**Multi-Device Synchronization, Audio Chimes & Voice Dispatch Verification**  
**Date:** November 12, 2026  
**Test Harness:** Vitest 4.1.12 with Live Firestore Client Emulation  
**Total Tests:** 170 Passed / 0 Failed (19 Test Suites)

---

## 1. Overview of Real-Time Subscriptions

RESTO OS connects mobile devices (customers, waiters, chefs, and cashiers) through reactive listeners that eliminate manual page refreshes:

```
Customer Device                Kitchen Display               Waiter Station               Cash Counter
┌──────────────┐              ┌───────────────┐             ┌───────────────┐            ┌──────────────┐
│  Permanent   │              │   Station 1   │             │   Handheld    │            │   Terminal   │
│   QR Scan    │              │   Kitchen     │             │   Terminal    │            │     POS      │
└──────┬───────┘              └───────▲───────┘             └───────▲───────┘            └──────▲───────┘
       │                              │                             │                           │
       │ Place Order                  │ onSnapshot                  │ onSnapshot                │ onSnapshot
       │ (placeOrderAsync)            │ kitchenTickets              │ waiterCalls & tickets     │ orders & bills
       ▼                              │                             │                           │
┌───────────────────────────────────────────────────────────────────────────────────────────────┴┐
│                              Cloud Firestore (resto-os-3bf6c)                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test Execution Breakdown

### 2.1 Table Management & KDS Pipeline Suite (`tests/table_management_and_kds_pipeline.test.ts`)
| Test ID | Scenario | Result |
|---|---|---|
| `TEST-TM-01` | Table defaults to AVAILABLE and stays AVAILABLE when QR is scanned for browsing | **PASSED** |
| `TEST-TM-02` | Placing an order marks the table OCCUPIED | **PASSED** |
| `TEST-TM-03` | Cancelling order reverts table to AVAILABLE if no other active orders exist | **PASSED** |
| `TEST-TM-04` | Confirming payment transitions table to CLEANING, staff marks cleaned transitions to AVAILABLE | **PASSED** |
| `TEST-KDS-01` | Order generates kitchen tickets by station with initial NEW status | **PASSED** |
| `TEST-KDS-02` | Kitchen status progression ACCEPTED $\rightarrow$ PREPARING $\rightarrow$ READY updates parent order | **PASSED** |
| `TEST-ORD-01` | Order price calculations strictly enforce subtotal + 2.5% CGST + 2.5% SGST | **PASSED** |
| `TEST-ORD-02` | Idempotent order submission prevents duplicate orders | **PASSED** |

### 2.2 Cross-Device Waiter Call Suite (`tests/cross_device_waiter_call.test.ts`)
| Test ID | Scenario | Result |
|---|---|---|
| `TEST-CROSS-01` | Customer initiates waiter call for Table T-01 with initial PENDING status | **PASSED** |
| `TEST-CROSS-02` | Full status lifecycle syncs between waiter and customer devices | **PASSED** |
| `TEST-CROSS-03` | Dashboard reload preserves pending calls on mount without dropping older calls | **PASSED** |
| `TEST-CROSS-04` | `adm-1` admin identity operates in supervisor mode seeing all tables and calls | **PASSED** |
| `TEST-CROSS-07` | Duplicate service requests for active session return existing call | **PASSED** |
| `TEST-CROSS-08` | Customer or staff can cancel active waiter call | **PASSED** |

### 2.3 Realtime Waiter Calling & Voice Alert Suite (`tests/waiter_calling_realtime.test.ts`)
| Test ID | Scenario | Result |
|---|---|---|
| `TEST-01` | Call Waiter button visible with assigned table | **PASSED** |
| `TEST-02` | Table session verified before initiating call | **PASSED** |
| `TEST-03` | Call created with table number, time, status, and request ID | **PASSED** |
| `TEST-04` | Waiter dashboard receives notification immediately | **PASSED** |
| `TEST-05` | Notification card displays all required fields | **PASSED** |
| `TEST-06` | Distinct notification sound plays on assigned waiter device | **PASSED** |
| `TEST-07` | Clear voice announcement speaks table number | **PASSED** |
| `TEST-08` | Waiter accepts call; status updates across both devices | **PASSED** |
| `TEST-09` | Waiter marks 'On the way'; customer sees updated status | **PASSED** |
| `TEST-10` | Waiter marks 'Arrived'; customer sees updated status | **PASSED** |
| `TEST-11` | Waiter completes call; request archived | **PASSED** |
| `TEST-12` | Unanswered call escalates to floor manager / supervisor | **PASSED** |
| `TEST-13` | Multiple simultaneous calls handled without dropping any | **PASSED** |
| `TEST-14` | Customer cannot flood waiter with duplicate requests | **PASSED** |
| `TEST-15` | Sound and voice configurable in waiter settings | **PASSED** |
| `TEST-16` | Mute toggle preserves visual alert banner | **PASSED** |
| `TEST-17` | Network reconnection syncs all pending calls | **PASSED** |
| `TEST-18` | Historical calls do not replay sound on page reload | **PASSED** |
| `TEST-19` | All actions logged in security audit history | **PASSED** |
| `TEST-20` | Customer can cancel call before waiter accepts | **PASSED** |

### 2.4 Section 16 Required Scenarios Suite (`tests/production_e2e_scenarios.test.ts`)
| Scenario ID | Test Specification | Verification Result |
|---|---|---|
| `TEST 1` | **TABLE AVAILABILITY:** Open QR $\rightarrow$ AVAILABLE; Browse menu $\rightarrow$ AVAILABLE; Cart $\rightarrow$ AVAILABLE; Place order $\rightarrow$ OCCUPIED | **PASSED** |
| `TEST 2` | **WAITER CALL:** Mobile customer calls waiter $\rightarrow$ exact table on waiter device $\rightarrow$ waiter accepts $\rightarrow$ customer status syncs | **PASSED** |
| `TEST 3` | **ORDER PIPELINE:** Full lifecycle NEW $\rightarrow$ ACCEPTED $\rightarrow$ PREPARING $\rightarrow$ READY $\rightarrow$ PICKED_UP $\rightarrow$ SERVED | **PASSED** |
| `TEST 4` | **CASH COUNTER:** Bill generation $\rightarrow$ cash recording $\rightarrow$ GST invoice $\rightarrow$ table CLEANING $\rightarrow$ staff mark cleaned $\rightarrow$ AVAILABLE | **PASSED** |
| `TEST 5` | **REFRESH & RECONNECTION:** Page reload and network reconnect recovers all pending calls and active orders | **PASSED** |
| `TEST 6` | **SECURITY:** Multi-tenant restaurant isolation, staff role escalation prevention, and invalid QR token rejection | **PASSED** |

---

## 3. Audio & Voice Announcement Verification

1. **Chime Synthesis:** Uses Web Audio API oscillator synthesis generating short, professional dual-frequency chimes without requiring external MP3 assets:
   - Waiter Call Bell: 880 Hz $\rightarrow$ 1174 Hz chime.
   - New Order Chime: 587 Hz $\rightarrow$ 880 Hz harmonic.
2. **Text-To-Speech (TTS):** Uses browser-native `window.speechSynthesis` with Indian English / standard accent:
   - *"Assistance requested at Table Number 10."*
   - *"Table 4 placed new order ORD-1420-581."*
   - *"Order ready for pickup at Tandoor Station."*
3. **De-duplication:** Tracks announced event IDs in `notifiedCallIdsRef` ensuring no duplicate speech triggers on component re-render.
