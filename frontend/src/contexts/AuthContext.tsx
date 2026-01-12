'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getIdToken,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'firebase_session';
const SESSION_DURATION = 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if session is still valid (within 15 days)
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (sessionData) {
          const { timestamp } = JSON.parse(sessionData);
          const now = Date.now();
          const sessionAge = now - timestamp;

          if (sessionAge > SESSION_DURATION) {
            // Session expired, sign out
            await signOut(auth);
            localStorage.removeItem(SESSION_KEY);
            setUser(null);
            setLoading(false);
            return;
          }
        }

        // Update session timestamp
        localStorage.setItem(SESSION_KEY, JSON.stringify({ timestamp: Date.now() }));
        setUser(firebaseUser);
      } else {
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Store session timestamp
      localStorage.setItem(SESSION_KEY, JSON.stringify({ timestamp: Date.now() }));
      setUser(result.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const token = await getIdToken(user);
      return token;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

