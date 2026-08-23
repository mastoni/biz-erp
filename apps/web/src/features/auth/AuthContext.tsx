'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api, setAccessToken, getAccessToken, setSessionExpiredCallback } from '@/lib/api';
import {
  type AuthScope,
  type TenantRole,
  type PlatformRole,
  type ScopeState,
  isTenant,
  isPlatform,
  isOwner,
  isCashier,
  isPlatformAdmin,
  isSuperAdmin,
  canAccessTenant,
  canAccessPlatform,
} from './scope';

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
  role: TenantRole;
  scope: AuthScope;
  platformRole: PlatformRole;
  accessToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  isTenant: () => boolean;
  isPlatform: () => boolean;
  isOwner: () => boolean;
  isCashier: () => boolean;
  isPlatformAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  canAccessTenant: (requireRole?: TenantRole[]) => boolean;
  canAccessPlatform: (requirePlatformRole?: PlatformRole[]) => boolean;
}

const EMPTY_STATE: AuthState = {
  status: 'loading',
  user: null,
  business: null,
  role: null,
  scope: null,
  platformRole: null,
  accessToken: null,
};

const UNAUTHENTICATED_STATE: AuthState = {
  status: 'unauthenticated',
  user: null,
  business: null,
  role: null,
  scope: null,
  platformRole: null,
  accessToken: null,
};

const SESSION_EXPIRED_STATE: AuthState = {
  status: 'sessionExpired',
  user: null,
  business: null,
  role: null,
  scope: null,
  platformRole: null,
  accessToken: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildScopeState(state: AuthState): ScopeState {
  return {
    scope: state.scope,
    role: state.role,
    platformRole: state.platformRole,
    business: state.business,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY_STATE);

  useEffect(() => {
    setSessionExpiredCallback(() => {
      setState(SESSION_EXPIRED_STATE);
    });

    const restoreSession = async () => {
      try {
        const token = getAccessToken();

        // Access token is memory-only.
        // After a full browser reload, there is no authenticated identity
        // available locally. The current backend refresh contract only
        // returns a new access token and does not return user/business/role/scope.
        if (!token) {
          setState(UNAUTHENTICATED_STATE);
          return;
        }

        setState((current) => ({
          ...current,
          status: 'authenticated',
          accessToken: token,
        }));
      } catch {
        setAccessToken(null);
        setState(SESSION_EXPIRED_STATE);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (data: Record<string, unknown>) => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      // The backend selects the auth context via the x-auth-context header.
      // Default (tenant) clients send nothing; this keeps existing tenant
      // login behavior byte-for-byte compatible.
      const headers: Record<string, string> = {};
      const context = (data as Record<string, unknown>)['x-auth-context'];
      if (context === 'platform' || context === 'tenant') {
        headers['x-auth-context'] = context as string;
      }

      const response = await api.post('/v1/auth/login', data, { headers });
      const payload = response.data as Record<string, unknown>;

      const scope: AuthScope =
        payload['scope'] === 'platform' ? 'platform' : 'tenant';
      const accessToken = payload['access_token'] as string;
      const user = (payload['user'] as User | undefined) ?? null;
      const backendRole = payload['role'] as TenantRole | PlatformRole | undefined;

      setAccessToken(accessToken);

      setState({
        status: 'authenticated',
        user,
        // Business context is only meaningful for tenant scope. Platform tokens
        // never carry a business_id (the claim is omitted, never null).
        business: scope === 'tenant' ? ((payload['business'] as Business | undefined) ?? null) : null,
        role: scope === 'tenant' ? ((backendRole as TenantRole) ?? null) : null,
        scope,
        platformRole: scope === 'platform' ? ((backendRole as PlatformRole) ?? null) : null,
        accessToken,
      });
    } catch (error) {
      setState(UNAUTHENTICATED_STATE);
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
      setState(UNAUTHENTICATED_STATE);
    }
  }, []);

  const scopeState = buildScopeState(state);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    isTenant: () => isTenant(scopeState),
    isPlatform: () => isPlatform(scopeState),
    isOwner: () => isOwner(scopeState),
    isCashier: () => isCashier(scopeState),
    isPlatformAdmin: () => isPlatformAdmin(scopeState),
    isSuperAdmin: () => isSuperAdmin(scopeState),
    canAccessTenant: (requireRole?: TenantRole[]) => canAccessTenant(scopeState, requireRole),
    canAccessPlatform: (requirePlatformRole?: PlatformRole[]) =>
      canAccessPlatform(scopeState, requirePlatformRole),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
