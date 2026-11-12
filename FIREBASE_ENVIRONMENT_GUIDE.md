# RESTO OS - Firebase Environment & Configuration Guide

**Document Version:** 1.0.0  
**Scope:** Client-side environment variables, security boundaries, and runtime configuration  

---

## 1. Environment Variables Overview

RESTO OS uses Vite's `import.meta.env` mechanism for client-side configuration. All variables intended for browser consumption MUST be prefixed with `VITE_`.

```bash
# Firebase Client Configuration (Spark ₹0 Tier)
VITE_FIREBASE_API_KEY=AIzaSyCXPAvSEUFL9KQ1mRXsodFLoNptIyrmUNU
VITE_FIREBASE_AUTH_DOMAIN=resto-os-3bf6c.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=resto-os-3bf6c
VITE_FIREBASE_STORAGE_BUCKET=resto-os-3bf6c.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=349513191718
VITE_FIREBASE_APP_ID=1:349513191718:web:aea175d7b371305a70f1e7
VITE_FIREBASE_MEASUREMENT_ID=G-KBX7T90Q88
VITE_FIREBASE_DATABASE_URL=https://resto-os-3bf6c-default-rtdb.firebaseio.com
VITE_FIREBASE_VAPID_KEY=

# Restaurant Defaults
VITE_DEFAULT_RESTAURANT_ID=rest-001-main
VITE_RESTAURANT_TIMEZONE=Asia/Kolkata
VITE_RESTAURANT_CURRENCY=INR
VITE_RESTAURANT_CURRENCY_SYMBOL=₹
```

---

## 2. Security Boundaries & Zero-Cost Constraints

### What Is Safe to Expose to the Browser (`VITE_` prefix):
- **Firebase API Key:** Firebase API keys identify your Firebase project to Google APIs. Unlike typical server API keys, Firebase web client API keys are **designed to be public in browser bundles**. Access control is enforced exclusively by **Firebase Security Rules** (`firestore.rules` and `database.rules.json`) and **Firebase Auth**.
- **Auth Domain, Project ID, App ID, Storage Bucket:** Project public identifiers.
- **Realtime Database URL:** The endpoint for the Realtime Database presence bus, secured by `database.rules.json`.
- **FCM Web Push (VAPID) Key:** Public VAPID key used for subscribing to browser push notifications.

### What MUST NEVER Be In `.env` or Client Code:
- **Firebase Admin SDK Service Account JSON:** Private keys (`private_key`, `client_email`) MUST NEVER be added to frontend code or prefixed with `VITE_`.
- **Google Cloud IAM Secret Keys:** Never bundle service account credentials into web bundles.
- If offline data migration is required, keep `service-account.json` in an uncommitted local directory excluded by `.gitignore` (e.g. `scripts/service-account.json`).

---

## 3. Graceful Fallback & Health Check Behavior

If required Firebase environment variables are missing (e.g. `VITE_FIREBASE_PROJECT_ID` is empty):
1. `isFirebaseConfigured()` returns `false`.
2. A clear, human-readable warning is logged to the browser console.
3. The application does not crash with a white screen; instead, `databaseAdapter.ts` falls back to its local-storage state engine, allowing the app to remain functional for review and testing.
4. When all variables are present, `isFirebaseConfigured()` returns `true`, and live Firestore + Realtime Database subscriptions are engaged.
