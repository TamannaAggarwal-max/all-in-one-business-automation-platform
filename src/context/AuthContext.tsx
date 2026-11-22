import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiRequest, setApiAccessToken, setTokenRefresher } from '../services/api';
import type { User } from '../types';

interface RegisterPayload {
  businessName: string;
  fullName: string;
  email: string;
  password: string;
  businessCategory: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  registerBusiness: (payload: RegisterPayload) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJwtSession, setIsJwtSession] = useState(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('bizpilot_auth_token');
    const storedUser = sessionStorage.getItem('bizpilot_auth_user');

    if (storedToken && storedUser) {
      try {
        setApiAccessToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
        setIsJwtSession(true);
        setLoading(false);
      } catch {
        sessionStorage.removeItem('bizpilot_auth_token');
        sessionStorage.removeItem('bizpilot_auth_user');
      }
    }

    setTokenRefresher(async () => {
      if (sessionStorage.getItem('bizpilot_auth_token')) {
        return sessionStorage.getItem('bizpilot_auth_token');
      }
      const fbUser = auth.currentUser;
      if (!fbUser) return null;
      const freshToken = await fbUser.getIdToken(true);
      setApiAccessToken(freshToken);
      return freshToken;
    });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (sessionStorage.getItem('bizpilot_auth_token')) {
        setLoading(false);
        return;
      }
      if (!fbUser) {
        setApiAccessToken(null);
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const token = await fbUser.getIdToken();
        setApiAccessToken(token);
        const data = await apiRequest<{ user: User }>('/api/auth/me');
        setUser(data.user);
      } catch {
        setApiAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });
    sessionStorage.setItem('bizpilot_auth_token', data.token);
    sessionStorage.setItem('bizpilot_auth_user', JSON.stringify(data.user));
    setIsJwtSession(true);
    setApiAccessToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const registerBusiness = useCallback(async (payload: RegisterPayload) => {
    const data = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(payload),
    });
    sessionStorage.setItem('bizpilot_auth_token', data.token);
    sessionStorage.setItem('bizpilot_auth_user', JSON.stringify(data.user));
    setIsJwtSession(true);
    setApiAccessToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    sessionStorage.removeItem('bizpilot_auth_token');
    sessionStorage.removeItem('bizpilot_auth_user');
    setIsJwtSession(false);
    setApiAccessToken(idToken);
    const data = await apiRequest<{ user: User }>('/api/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    sessionStorage.removeItem('bizpilot_auth_token');
    sessionStorage.removeItem('bizpilot_auth_user');
    setIsJwtSession(false);
    setApiAccessToken(null);
    setUser(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        registerBusiness,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
