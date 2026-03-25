import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        const docRef = doc(db, 'users', user.uid);
        
        // Use onSnapshot for reactive profile updates
        unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Normalize old roles for backward compatibility
            if (data.role === 'admin') data.role = 'ADMINISTRADOR';
            if (data.role === 'manager') data.role = 'GERENTE';
            if (data.role === 'seller') data.role = 'VENDEDOR';
            if (data.role === 'BALCONISTA') data.role = 'VENDEDOR';
            
            // Ensure the main admin email always has the correct role
            if (user.email === 'tavares345@gmail.com' && data.role !== 'ADMINISTRADOR') {
              data.role = 'ADMINISTRADOR';
            }
            
            setProfile(data as UserProfile);
            setLoading(false);
          } else {
            // Create default profile for new users (first user as admin)
            const newProfile: UserProfile = {
              uid: user.uid,
              name: user.displayName || 'Usuário',
              email: user.email || '',
              role: user.email === 'tavares345@gmail.com' ? 'ADMINISTRADOR' : 'VENDEDOR',
            };
            await setDoc(docRef, newProfile);
            // onSnapshot will trigger again after setDoc
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
