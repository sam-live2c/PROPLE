import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firestore with persistent multi-tab local cache for offline capabilities and force long polling
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
}, dbId === "(default)" ? undefined : dbId);

export const auth = getAuth();
export const rtdb = getDatabase(app);



