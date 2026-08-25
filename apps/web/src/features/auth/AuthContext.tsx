'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { api, setAccessToken, getAccessToken, setSessionExpiredCallback } from '@/lib/api';
import {
  type AuthScope,
  type TenantRole,
  type PlatformRole,
  type TenantStatus,
  type ScopeState,
  type Business,
  isValidBusinessId,
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

export type { Business };

export interface AuthState {
  status: SessionStatus;
  tenantStatus: TenantStatus;
  user: User | null;
  business: Business | null;
  availableBusinesses: Business[];
  role: TenantRole;
  scope: AuthScope;
  platformRole: PlatformRole;
  accessToken: string | null;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (businessId: string) => Promise<void>;
  setAvailableBusinesses: (businesses: Business[]) => void;
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
  tenantStatus: 'loading',
  user: null,
  business: null,
  availableBusinesses: [],
  role: null,
  scope: null,
  platformRole: null,
  accessToken: null,
  error: null,
};

const UNAUTHENTICATED_STATE: AuthState = {
  status: 'unauthenticated',
  tenantStatus: 'empty',
  user: null,
  business: null,
  availableBusinesses: [],
  role: null,
  scope: null,
  platformRole: null,
  accessToken: null,
  error: null,
};

const SESSION_EXPIRED_STATE: AuthState = {
  status: 'sessionExpired',
  tenantStatus: 'empty',
  user: null,
  business: null,
  availableBusinesses: [],
  role: null,
  scope: null,
  platformRole: null,
  accessToken: null,
  error: 'Sesi telah berakhir',
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
  const transientCreds = useRef<{ email?: string; password?: string }>({});

  useEffect(() => {
    setSessionExpiredCallback(() => {
      setState(SESSION_EXPIRED_STATE);
    });

    const restoreSession = async () => {
      try {
        const token = getAccessToken();

        // Access token is memory-only.
        if (!token) {
          setState(UNAUTHENTICATED_STATE);
          return;
        }

        setState((current) => ({
          ...current,
          status: 'authenticated',
          tenantStatus: current.business ? 'active' : 'loading',
          accessToken: token,
        }));
      } catch {
        setAccessToken(null);
        setState(SESSION_EXPIRED_STATE);
      }
    };

    restoreSession();
  }, []);

  const setAvailableBusinesses = useCallback((businesses: Business[]) => {
    setState((s) => ({
      ...s,
      availableBusinesses: businesses,
    }));
  }, []);

  const login = useCallback(async (data: Record<string, unknown>) => {
    setState((s) => ({ ...s, status: 'loading', tenantStatus: 'loading', error: null }));
    try {
      if (typeof data.email === 'string') {
        transientCreds.current.email = data.email;
      }
      if (typeof data.password === 'string') {
        transientCreds.current.password = data.password;
      }

      const headers: Record<string, string> = {};
      const context = (data as Record<string, unknown>)['x-auth-context'];
      if (context === 'platform' || context === 'tenant') {
        headers['x-auth-context'] = context as string;
      }

      // Filter out client-side metadata before sending to API
      const { available_businesses: clientAvailableBusinesses, ...requestPayload } = data;

      const response = await api.post('/v1/auth/login', requestPayload, { headers });
      const payload = response.data as Record<string, unknown>;

      const scope: AuthScope =
        payload['scope'] === 'platform' ? 'platform' : 'tenant';
      const accessToken = payload['access_token'] as string;
      const user = (payload['user'] as User | undefined) ?? null;
      const backendRole = payload['role'] as TenantRole | PlatformRole | undefined;
      const business = scope === 'tenant' ? ((payload['business'] as Business | undefined) ?? null) : null;

      setAccessToken(accessToken);

      let availableList: Business[] = [];
      if (Array.isArray(clientAvailableBusinesses)) {
        availableList = clientAvailableBusinesses as Business[];
      } else if (Array.isArray(payload['available_businesses'])) {
        availableList = payload['available_businesses'] as Business[];
      } else if (business) {
        availableList = [business];
      }

      setState({
        status: 'authenticated',
        tenantStatus: scope === 'tenant' && business ? 'active' : 'empty',
        user,
        business,
        availableBusinesses: availableList,
        role: scope === 'tenant' ? ((backendRole as TenantRole) ?? null) : null,
        scope,
        platformRole: scope === 'platform' ? ((backendRole as PlatformRole) ?? null) : null,
        accessToken,
        error: null,
      });
    } catch (error) {
      setState(UNAUTHENTICATED_STATE);
      throw error;
    }
  }, []);

  const switchTenant = useCallback(async (businessId: string) => {
    if (!isValidBusinessId(businessId)) {
      const err = new Error('Invalid business UUID format');
      setState((s) => ({ ...s, error: err.message, tenantStatus: 'error' }));
      throw err;
    }

    // Tenant isolation guard: User can ONLY switch to a business in their availableBusinesses
    const targetTenant = state.availableBusinesses.find((b) => b.id === businessId);
    if (state.availableBusinesses.length > 0 && !targetTenant) {
      const err = new Error('Access denied: Tenant not found in user memberships');
      setState((s) => ({ ...s, error: err.message, tenantStatus: 'error' }));
      throw err;
    }

    if (state.business?.id === businessId && state.tenantStatus === 'active') {
      return;
    }

    const previousState = state;
    setState((s) => ({
      ...s,
      tenantStatus: 'switching',
      error: null,
    }));

    try {
      const email = transientCreds.current.email || state.user?.email;
      const password = transientCreds.current.password;

      if (!email || !password) {
        // If credentials are not in memory, re-authentication is required
        throw new Error('Re-authentication required to switch tenant');
      }

      const response = await api.post('/v1/auth/login', {
        email,
        password,
        business_id: businessId,
      });

      const payload = response.data as Record<string, unknown>;
      const accessToken = payload['access_token'] as string;
      const user = (payload['user'] as User | undefined) ?? state.user;
      const backendRole = payload['role'] as TenantRole | undefined;
      const business = (payload['business'] as Business | undefined) ?? targetTenant ?? { id: businessId, name: 'Tenant' };

      setAccessToken(accessToken);

      setState((s) => ({
        ...s,
        status: 'authenticated',
        tenantStatus: 'active',
        user,
        business,
        role: (backendRole as TenantRole) ?? null,
        scope: 'tenant',
        accessToken,
        error: null,
      }));
    } catch (error) {
      // Revert to previous valid state or mark as error without leaking cross-tenant data
      setState({
        ...previousState,
        tenantStatus: 'error',
        error: error instanceof Error ? error.message : 'Failed to switch tenant',
      });
      throw error;
    }
  }, [state]);

  const logout = useCallback(async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch {
      // Ignored
    } finally {
      transientCreds.current = {};
      setAccessToken(null);
      setState(UNAUTHENTICATED_STATE);
    }
  }, []);

  const scopeState = buildScopeState(state);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    switchTenant,
    setAvailableBusinesses,
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
