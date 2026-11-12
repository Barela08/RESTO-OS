// ====================================================================
// RESTO OS - Optional Local Firestore Seed Import Script
// Uses Firebase Admin SDK to import JSON seed files into Firestore
// ====================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.resolve(__dirname, 'service-account.json');

async function runImport() {
  if (!fs.existsSync(serviceAccountPath)) {
    console.log('\n======================================================');
    console.log('NOTICE: No service-account.json found in scripts/ folder.');
    console.log('To use this automated script:');
    console.log('1. Go to Firebase Console > Project Settings > Service Accounts.');
    console.log('2. Click "Generate new private key".');
    console.log('3. Save the downloaded JSON file as scripts/service-account.json');
    console.log('4. Run: node scripts/import-firestore-data.js');
    console.log('======================================================\n');
    console.log('Alternatively, you can manually add collections using');
    console.log('the JSON templates in firestore-import-template/ and');
    console.log('the instructions in firestore-import-template/import-instructions.md.\n');
    process.exit(0);
  }

  try {
    const admin = await import('firebase-admin');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const db = admin.firestore();
    const templateDir = path.resolve(__dirname, '../firestore-import-template');

    const collectionsToImport = [
      { name: 'restaurants', file: 'restaurants.json' },
      { name: 'staffRoles', file: 'staffRoles.json' },
      { name: 'rolePermissions', file: 'rolePermissions.json' },
      { name: 'kitchenStations', file: 'kitchenStations.json' },
      { name: 'restaurantTables', file: 'restaurantTables.json' },
      { name: 'menuCategories', file: 'menuCategories.json' },
      { name: 'menuItems', file: 'menuItems.json' },
      { name: 'menuAddons', file: 'menuAddons.json' },
      { name: 'staff', file: 'staff.json' },
      { name: 'users', file: 'users.json' },
    ];

    console.log('[Import] Starting Firestore data import...\n');

    for (const item of collectionsToImport) {
      const filePath = path.join(templateDir, item.file);
      if (!fs.existsSync(filePath)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`[Import] Uploading collection: ${item.name} (${data.length} records)...`);

      const batch = db.batch();
      data.forEach((docData) => {
        const docId = docData._id || docData.id || `doc-${Date.now()}`;
        const cleanData = { ...docData };
        delete cleanData._id;
        delete cleanData._comment;

        cleanData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        cleanData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        const docRef = db.collection(item.name).doc(docId);
        batch.set(docRef, cleanData, { merge: true });
      });

      await batch.commit();
      console.log(`[Import] Successfully imported ${item.name}`);
    }

    console.log('\n[Import] Complete! All collections have been seeded to Cloud Firestore.');
  } catch (err) {
    console.error('[Import] Error importing data:', err);
  }
}

runImport();
