'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api, setAccessToken, getAccessToken, setSessionExpiredCallback } from '@/lib/api';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'sessionExpired';

export interface User {
  id: string;
  email: string;
  status: string;
}

export interface Business {
  id: string;
  name: string;
}

export interface AuthState {
  status: SessionStatus;
  user: User | null;
  business: Business | null;
  role: 'OWNER' | 'CASHIER' | null;
  accessToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    business: null,
    role: null,
    accessToken: null,
  });

  useEffect(() => {
    setSessionExpiredCallback(() => {
      setState({ status: 'sessionExpired', user: null, business: null, role: null, accessToken: null });
    });

    const restoreSession = async () => {
      try {
        let token = getAccessToken();
        
        if (!token) {
          const refreshRes = await api.post('/v1/auth/refresh');
          token = refreshRes.data.access_token;
          setAccessToken(token);
        }

        const meRes = await api.get('/v1/auth/me');
        const { user, business, role } = meRes.data;

        setState({
          status: 'authenticated',
          user,
          business,
          role,
          accessToken: token,
        });
      } catch {
        setState({ status: 'sessionExpired', user: null, business: null, role: null, accessToken: null });
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (data: Record<string, unknown>) => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const response = await api.post('/v1/auth/login', data);
      const { access_token, user, business, role } = response.data;
      
      setAccessToken(access_token);
      
      setState({
        status: 'authenticated',
        user,
        business,
        role,
        accessToken: access_token,
      });
    } catch (error) {
      setState({ status: 'unauthenticated', user: null, business: null, role: null, accessToken: null });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch {
      // Ignored
    } finally {
      setAccessToken(null);
      setState({ status: 'unauthenticated', user: null, business: null, role: null, accessToken: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
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
