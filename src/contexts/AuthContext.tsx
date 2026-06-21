import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInAsGuest: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: () => void = () => {};

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          try {
            const { query, where, getDocs, collection } = await import('firebase/firestore');
            const baseHandle = currentUser.email?.split('@')[0] || `user_${currentUser.uid.slice(0, 5)}`;
            let uniqueHandle = baseHandle.replace(/\s+/g, "");
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 10) {
              const q = query(collection(db, "users"), where("handle", "==", uniqueHandle));
              const querySnapshot = await getDocs(q);
              if (querySnapshot.docs.length === 0) {
                isUnique = true;
              } else {
                attempts++;
                uniqueHandle = `${baseHandle.replace(/\s+/g, "")}${Math.floor(Math.random() * 9999)}`;
              }
            }

            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              handle: uniqueHandle,
              displayName: currentUser.displayName || 'Anonymous Explorer',
              photoURL: currentUser.photoURL || null,
              role: 'user',
              trustScore: 0,
              onboardingCompleted: false,
              interests: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            console.error("Error creating user profile", e);
          }
        }

        import('firebase/firestore').then(({ onSnapshot }) => {
          profileUnsubscribe = onSnapshot(userRef, (doc) => {
             if (doc.exists()) setUserProfile({ id: doc.id, ...doc.data() });
          });
        });
      } else {
        setUserProfile(null);
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
       unsubscribe();
       profileUnsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Successfully logged in!");
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log("Authentication popup closed by user.");
      } else if (error.code === 'auth/unauthorized-domain') {
        console.error("Firebase auth domain not authorized", error);
        toast.error("Unable to complete login. Please open this app in a new tab.");
      } else if (error.code === 'auth/popup-blocked') {
        toast.error("Login popup blocked. Please open this app in a new tab.");
      } else {
        console.error("Error signing in with Google", error);
        toast.error("Unable to complete login. Please try again.");
      }
    }
  };

  const signInAsGuest = async () => {
    try {
      await signInAnonymously(auth);
      toast.success("Successfully logged in as Guest!");
    } catch (error) {
      console.error("Error signing in anonymously", error);
      toast.error("Unable to complete guest login. Please try again.");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signInAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
