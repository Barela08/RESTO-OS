// ====================================================================
// RESTO OS - Centralized Firebase Configuration & Modular SDK Services
// Spark (₹0 Tier) Compatible | Safe Singleton Initialization
// ====================================================================

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

export interface FirebaseConfigOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  databaseURL?: string;
  vapidKey?: string;
}

// Read from Vite import.meta.env
const apiKey: string = (import.meta.env.VITE_FIREBASE_API_KEY as string) || '';
const authDomain: string = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '';
const projectId: string = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '';
const storageBucket: string = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '';
const messagingSenderId: string = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '';
const appId: string = (import.meta.env.VITE_FIREBASE_APP_ID as string) || '';
const measurementId: string = (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || '';
const databaseURL: string =
  (import.meta.env.VITE_FIREBASE_DATABASE_URL as string) ||
  (projectId ? `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app` : '');
const vapidKey: string = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string) || '';

export const firebaseConfig: FirebaseConfigOptions = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId: measurementId || undefined,
  databaseURL: databaseURL || undefined,
  vapidKey: vapidKey || undefined,
};

/**
 * Validates whether the minimum required Firebase configuration is present
 */
export const isFirebaseConfigured = (): boolean => {
  return (
    !!apiKey &&
    !apiKey.includes('placeholder') &&
    !!projectId &&
    !projectId.includes('your-project') &&
    !!appId
  );
};

export const getFirebaseConfig = () => ({
  ...firebaseConfig,
  isLive: isFirebaseConfigured(),
});

// Singleton instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as any);
    auth = getAuth(app);
    db = getFirestore(app);
    if (databaseURL) {
      rtdb = getDatabase(app, databaseURL);
    } else {
      rtdb = getDatabase(app);
    }
  } catch (err) {
    console.warn('[Firebase] Initialization error:', err);
  }
} else {
  // If required values are missing, log a clear setup guide
  if (typeof window !== 'undefined') {
    console.info(
      '[Firebase] Notice: Firebase client is not fully configured in .env. Falling back to local storage adapter.'
    );
  }
}

/**
 * Safe FCM Messaging instance resolver with browser support detection
 */
export const getFCM = async (): Promise<Messaging | null> => {
  if (!app) return null;
  if (typeof window === 'undefined') return null;

  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => {
        if (supported && app) {
          return getMessaging(app);
        }
        return null;
      })
      .catch((err) => {
        console.warn('[Firebase FCM] Not supported in this environment:', err);
        return null;
      });
  }

  return messagingPromise;
};

// Export services
export { app, auth, db, rtdb };
