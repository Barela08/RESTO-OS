// ====================================================================
// RESTO OS - Firebase Authentication Service (Spark ₹0 Compatible)
// Email/Password Staff Auth, Firestore Role Retrieval & Presence Bridge
// ====================================================================

import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreUser } from '../../types/firestore';
import { rtdbPresenceService } from './rtdbPresenceService';

export class FirebaseAuthService {
  /**
   * Authenticate staff with username or email against Firebase Auth
   * and read verified role from Firestore users/{uid}
   */
  public static async signInStaff(
    loginId: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: FirebaseUser;
    profile?: FirestoreUser;
    error?: string;
  }> {
    if (!auth || !isFirebaseConfigured()) {
      return { success: false, error: 'Firebase Auth is not configured' };
    }

    try {
      const cleanLogin = loginId.trim().toLowerCase();
      // Map username to email format if user entered bare username
      const email = cleanLogin.includes('@')
        ? cleanLogin
        : `${cleanLogin}@thegrandbistro.in`;

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = credential.user;

      // Read user document from Firestore to retrieve verified role
      let profile: FirestoreUser | undefined;
      if (db) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          profile = { ...userDocSnap.data(), userId: userDocSnap.id } as FirestoreUser;
        }
      }

      // If document not yet created in Firestore, derive initial profile
      if (!profile) {
        const derivedRole = cleanLogin.includes('owner')
          ? 'owner'
          : cleanLogin.includes('admin')
          ? 'admin'
          : cleanLogin.includes('counter')
          ? 'counter'
          : cleanLogin.includes('kitchen')
          ? 'kitchen'
          : 'waiter';

        profile = {
          userId: fbUser.uid,
          restaurantId: 'rest-001-main',
          email: fbUser.email || email,
          username: cleanLogin,
          fullName: fbUser.displayName || cleanLogin.toUpperCase(),
          role: derivedRole as any,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
      }

      // Register presence on Realtime Database
      rtdbPresenceService.registerPresence(
        profile.restaurantId,
        profile.userId,
        profile.role as any,
        profile.fullName
      );

      return {
        success: true,
        user: fbUser,
        profile,
      };
    } catch (err: any) {
      console.warn('[Firebase Auth] Sign in error:', err);
      let errorMsg = 'Invalid username or password.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Invalid username or password.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed attempts. Account temporarily locked for 15 minutes.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Log out from Firebase Auth
   */
  public static async signOutStaff(): Promise<void> {
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('[Firebase Auth] Sign out error:', err);
      }
    }
  }

  /**
   * Listen to Firebase Auth state changes
   */
  public static onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  }
}
