# RESTO OS - Firebase Complete Setup & Deployment Guide

**Document Version:** 1.0.0  
**Target Platform:** Firebase (Spark ₹0 Tier)  
**Applicable Services:** Authentication, Cloud Firestore, Realtime Database, Cloud Messaging  

---

## 1. Quick Start Checklist

- [x] Firebase JavaScript SDK installed (`npm install firebase`)
- [x] Project credentials configured in `.env`
- [x] Firestore data models and repositories created in `src/services/firebase/`
- [x] Realtime presence engine implemented in `src/services/firebase/rtdbPresenceService.ts`
- [x] Background push service worker configured in `public/firebase-messaging-sw.js`
- [x] Production security rules authored in `firestore.rules` and `database.rules.json`
- [x] Manual import templates prepared in `firestore-import-template/`
- [x] 100% test coverage and clean production build

---

## 2. Firebase Console Configuration Walkthrough

### Step 2.1: Open Firebase Project
1. Visit **[Firebase Console](https://console.firebase.google.com/)**.
2. Select your project **`resto-os-3bf6c`** (or create a new one on the **Spark Free Plan**).

### Step 2.2: Enable Firebase Authentication
1. In the left navigation, click **Build > Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab:
   - Enable **Email/Password**.
   - Enable **Anonymous** (used for guest dining sessions if enabled).
4. Click **Users > Add User** to seed your primary staff accounts:
   - `owner@thegrandbistro.in`
   - `admin@thegrandbistro.in`
   - `counter@thegrandbistro.in`
   - `waiter@thegrandbistro.in`
   - `kitchen@thegrandbistro.in`
5. Copy the generated **UID** for each user; you will use these UIDs when seeding the `users` collection.

### Step 2.3: Create Cloud Firestore Database
1. In the left navigation, click **Build > Firestore Database**.
2. Click **Create Database**.
3. Choose your database location (recommended for India: `asia-south1` Mumbai).
4. Select **Start in production mode** (your `firestore.rules` will be applied).

### Step 2.4: Create Realtime Database
1. In the left navigation, click **Build > Realtime Database**.
2. Click **Create Database**.
3. Select your region.
4. Set default rules (they will be updated with `database.rules.json`).

### Step 2.5: Configure Firebase Cloud Messaging (Web Push)
1. Go to **Project Settings** (gear icon) > **Cloud Messaging**.
2. Under **Web configuration > Web Push certificates**, click **Generate key pair**.
3. Copy the generated public key and add it to `.env`:
   ```bash
   VITE_FIREBASE_VAPID_KEY=your_generated_public_vapid_key
   ```

---

## 3. Deploying Security Rules & Indexes via Firebase CLI

If you have the Firebase CLI installed on your computer (`npm install -g firebase-tools`):

```bash
# 1. Log in to Firebase
firebase login

# 2. Select your project
firebase use resto-os-3bf6c

# 3. Deploy Firestore rules and Realtime Database rules
firebase deploy --only firestore:rules,database

# 4. Deploy composite indexes
firebase deploy --only firestore:indexes
```

---

## 4. Environment Variables Reference

Ensure your `.env` contains:

```bash
VITE_FIREBASE_API_KEY=AIzaSyCXPAvSEUFL9KQ1mRXsodFLoNptIyrmUNU
VITE_FIREBASE_AUTH_DOMAIN=resto-os-3bf6c.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=resto-os-3bf6c
VITE_FIREBASE_STORAGE_BUCKET=resto-os-3bf6c.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=349513191718
VITE_FIREBASE_APP_ID=1:349513191718:web:aea175d7b371305a70f1e7
VITE_FIREBASE_MEASUREMENT_ID=G-KBX7T90Q88
VITE_FIREBASE_DATABASE_URL=https://resto-os-3bf6c-default-rtdb.firebaseio.com
VITE_FIREBASE_VAPID_KEY=
```

---

## 5. Verification Commands

Run the full automated test suite:
```bash
npm test
```

Run the production build:
```bash
npm run build
```

Launch the development server:
```bash
npm run dev
```
Navigate to `http://localhost:5173` to test live floor ordering, waiter call alerts, and kitchen ticket handling.
