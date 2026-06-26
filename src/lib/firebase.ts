import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  }, dbId === "(default)" ? undefined : dbId);
} catch (error) {
  console.warn("Failed to initialize Firestore with persistent local cache, falling back to standard/memory-only mode:", error);
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, dbId === "(default)" ? undefined : dbId);
}

export const db = dbInstance;

export const auth = getAuth();
export const rtdb = getDatabase(app);



