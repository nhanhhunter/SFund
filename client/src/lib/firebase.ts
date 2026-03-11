import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

export const isFirebaseConfigured = requiredConfig.every(
  (value) => typeof value === "string" && value.trim().length > 0,
);

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;
let emulatorsConnected = false;

if (isFirebaseConfigured) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firestoreDb = getFirestore(firebaseApp);

  setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
    // Ignore persistence failures in restricted browsers.
  });

  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_FIREBASE_USE_EMULATORS === "true" &&
    !emulatorsConnected
  ) {
    const authEmulatorUrl =
      import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099";
    const firestoreHost =
      import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || "127.0.0.1";
    const firestorePort = Number(
      import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || "8080",
    );

    connectAuthEmulator(firebaseAuth, authEmulatorUrl, { disableWarnings: true });
    connectFirestoreEmulator(firestoreDb, firestoreHost, firestorePort);
    emulatorsConnected = true;
  }
}

export const app = firebaseApp;
export const auth = firebaseAuth;
export const db = firestoreDb;
export const googleProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null;

googleProvider?.setCustomParameters({ prompt: "select_account" });
