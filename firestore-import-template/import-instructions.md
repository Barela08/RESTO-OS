# RESTO OS - Manual Firebase Console Import Instructions

This guide provides step-by-step instructions to manually upload your restaurant seed data into Cloud Firestore via the **Firebase Console**.

---

## 1. Prerequisites in Firebase Console

1. Navigate to **[Firebase Console](https://console.firebase.google.com/project/resto-os-3bf6c)**.
2. In the left sidebar, click **Build > Authentication**:
   - Click **Get Started**.
   - Enable **Email/Password** sign-in method.
   - Click **Users > Add User** to create accounts for your staff:
     - `owner@thegrandbistro.in` (Note down the generated **User UID**)
     - `admin@thegrandbistro.in` (Note down the generated **User UID**)
     - `counter@thegrandbistro.in` (Note down the generated **User UID**)
     - `waiter@thegrandbistro.in` (Note down the generated **User UID**)
     - `kitchen@thegrandbistro.in` (Note down the generated **User UID**)
3. In the left sidebar, click **Build > Firestore Database**:
   - Click **Create Database**.
   - Choose your preferred location (e.g. `asia-south1` Mumbai).
   - Start in **Production Mode** (your rules will be applied via `firestore.rules`).
4. In the left sidebar, click **Build > Realtime Database**:
   - Click **Create Database**.
   - Choose your region.

---

## 2. Step-by-Step Collection Creation in Firestore Console

For each collection below, click **Start collection** in the Firestore Console, enter the **Collection ID**, specify the **Document ID** from the JSON file, and add the corresponding fields.

### Step 2.1: `restaurants` Collection
- **Collection ID:** `restaurants`
- **Document ID:** `rest-001-main`
- **Fields:** Copy from `restaurants.json`:
  - `name`: string `"The Grand Bistro & Craft Kitchen"`
  - `tagline`: string `"Artisanal Flavors, Smart Dining Experience"`
  - `currency`: string `"INR"`
  - `currencySymbol`: string `"₹"`
  - `timezone`: string `"Asia/Kolkata"`
  - `phone`: string `"+91 98765 43210"`
  - `email`: string `"contact@thegrandbistro.in"`
  - `gstin`: string `"29ABCDE1234F1Z5"`
  - `fssaiLicense`: string `"11223344556677"`
  - `settings`: map with `cgstRate: 0.025`, `sgstRate: 0.025`, `autoAcceptOrders: false`, `voiceEnabled: true`, `voiceLanguage: "hi"`, `soundVolume: 0.9`
  - `isActive`: boolean `true`

### Step 2.2: `users` Collection (Critical for Security & RBAC)
- **Collection ID:** `users`
- **Document ID:** Use the **User UID** copied from Firebase Authentication for that user.
- **Fields:** Copy from `users.json`:
  - `restaurantId`: string `"rest-001-main"`
  - `email`: string (e.g. `"owner@thegrandbistro.in"`)
  - `username`: string (e.g. `"owner"`)
  - `fullName`: string
  - `role`: string (`"owner"`, `"admin"`, `"counter"`, `"waiter"`, or `"kitchen"`)
  - `employeeId`: string
  - `isActive`: boolean `true`

### Step 2.3: `staff` Collection
- **Collection ID:** `staff`
- **Document IDs:** `st-own-01`, `st-adm-01`, `st-ctr-01`, `st-wtr-01`, `st-kit-01`
- **Fields:** Copy from `staff.json` (ensure `userId` points to the corresponding Auth UID).

### Step 2.4: `restaurantTables` Collection
- **Collection ID:** `restaurantTables`
- **Document IDs:** `tbl-01`, `tbl-02`, `tbl-03`, `tbl-04`, `tbl-05`, `tbl-10`
- **Fields:** Copy from `restaurantTables.json`.

### Step 2.5: `menuCategories` Collection
- **Collection ID:** `menuCategories`
- **Document IDs:** `cat-starters`, `cat-mains`, `cat-breads`, `cat-desserts`, `cat-beverages`
- **Fields:** Copy from `menuCategories.json`.

### Step 2.6: `menuItems` Collection
- **Collection ID:** `menuItems`
- **Document IDs:** `itm-paneer-tikka`, `itm-murgh-tikka`, `itm-dal-makhani`, `itm-butter-chicken`, `itm-garlic-naan`, `itm-gulab-jamun`
- **Fields:** Copy from `menuItems.json`. Ensure `categoryId` and `kitchenStationId` match existing documents.

### Step 2.7: `menuAddons` Collection
- **Collection ID:** `menuAddons`
- **Document IDs:** `add-extra-butter`, `add-extra-gravy`, `add-mint-chutney`
- **Fields:** Copy from `menuAddons.json`.

### Step 2.8: `kitchenStations` Collection
- **Collection ID:** `kitchenStations`
- **Document IDs:** `sta-curry`, `sta-tandoor`, `sta-beverage`, `sta-dessert`
- **Fields:** Copy from `kitchenStations.json`.

---

## 3. Reference & Foreign Key Integrity Table

| Collection | Field | Referenced Collection | Example Reference Value |
|---|---|---|---|
| `users` | `restaurantId` | `restaurants` | `"rest-001-main"` |
| `staff` | `userId` | `users` | `request.auth.uid` |
| `restaurantTables` | `currentWaiterId` | `staff` | `"st-wtr-01"` |
| `menuItems` | `categoryId` | `menuCategories` | `"cat-starters"` |
| `menuItems` | `kitchenStationId` | `kitchenStations` | `"sta-tandoor"` |
| `orders` | `tableSessionId` | `tableSessions` | `"ses-20261112-..."` |
| `invoices` | `orderIds` | `orders` | `["ord-20261112-..."]` |
| `payments` | `invoiceId` | `invoices` | `"inv-20261112-..."` |

---

## 4. Optional Automated Local Import Script

If you prefer to import all JSON files in one command instead of manual console entry, use the provided helper script:
```bash
# 1. Place your private service-account key from Google Cloud / Firebase at:
#    scripts/service-account.json (Never commit this file!)

# 2. Run the import script
node scripts/import-firestore-data.js
```
*(The script will read files from `firestore-import-template/` and upload them directly to Firestore using Firebase Admin SDK).*
