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
        const token = getAccessToken();

        // Access token is memory-only.
        // After a full browser reload, there is no authenticated identity
        // available locally. The current backend refresh contract only
        // returns a new access token and does not return user/business/role.
        if (!token) {
          setState({
            status: 'unauthenticated',
            user: null,
            business: null,
            role: null,
            accessToken: null,
          });
          return;
        }

        setState((current) => ({
          ...current,
          status: 'authenticated',
          accessToken: token,
        }));
      } catch {
        setAccessToken(null);

        setState({
          status: 'sessionExpired',
          user: null,
          business: null,
          role: null,
          accessToken: null,
        });
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
