'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlatformBusinesses,
  getPlatformContext,
  getPlatformModules,
  getPlatformPlans,
  getPlatformSubscriptions,
} from './api';
import { getApiErrorInfo } from './list-helpers';
import type {
  PlatformBusiness,
  PlatformContext,
  PlatformModule,
  PlatformOverviewKPIs,
  PlatformOverviewState,
  PlatformPlan,
  PlatformSubscription,
  PlanDistributionItem,
  SubscriptionStatusDistributionItem,
} from './types';

const FALLBACK_ERROR = 'Terjadi kesalahan saat memuat data platform.';

const PLAN_COLORS = ['#35657f', '#17593e', '#d3921f', '#bc4b2f', '#68746c'];

export function usePlatformOverviewViewModel(): PlatformOverviewState {
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [businesses, setBusinesses] = useState<PlatformBusiness[]>([]);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [subscriptions, setSubscriptions] = useState<PlatformSubscription[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const activeRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRequestId(null);

    try {
      const [ctxRes, bizRes, subRes, plansRes, modsRes] = await Promise.allSettled([
        getPlatformContext(),
        getPlatformBusinesses(200, 0),
        getPlatformSubscriptions(200, 0),
        getPlatformPlans(200, 0),
        getPlatformModules(200, 0),
      ]);

      if (!activeRef.current) return;

      if (ctxRes.status === 'fulfilled') {
        setContext(ctxRes.value);
      }

      if (bizRes.status === 'fulfilled') {
        setBusinesses(bizRes.value.items || []);
        setTotalBusinesses(bizRes.value.total || 0);
      }

      if (subRes.status === 'fulfilled') {
        setSubscriptions(subRes.value.items || []);
      }

      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.items || []);
      }

      if (modsRes.status === 'fulfilled') {
        setModules(modsRes.value.items || []);
      }

      // If all failed, report error
      if (
        ctxRes.status === 'rejected' &&
        bizRes.status === 'rejected' &&
        subRes.status === 'rejected'
      ) {
        const info = getApiErrorInfo(ctxRes.reason, FALLBACK_ERROR);
        setError(info.message);
        setRequestId(info.requestId);
      }
    } catch (err) {
      if (!activeRef.current) return;
      const info = getApiErrorInfo(err, FALLBACK_ERROR);
      setError(info.message);
      setRequestId(info.requestId);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchData();
    return () => {
      activeRef.current = false;
    };
  }, [fetchData, reloadKey]);

  const kpis: PlatformOverviewKPIs = useMemo(() => {
    const activeSubs = subscriptions.filter(
      (s) => s.status === 'active' || s.status === 'trial' || s.status === 'aktif' || !s.status
    ).length;

    const mrr = subscriptions.reduce((sum, s) => {
      const price = typeof s.final_price === 'number' ? s.final_price : 0;
      return sum + price;
    }, 0);

    return {
      total_businesses: totalBusinesses || businesses.length,
      active_subscriptions: activeSubs,
      estimated_mrr_minor: mrr,
      total_plans: plans.length,
      total_modules: modules.length,
    };
  }, [businesses, totalBusinesses, subscriptions, plans, modules]);

  const planDistribution: PlanDistributionItem[] = useMemo(() => {
    const planCounts = new Map<string, number>();
    subscriptions.forEach((s) => {
      const code = s.plan_code || 'unknown';
      planCounts.set(code, (planCounts.get(code) || 0) + 1);
    });

    return Array.from(planCounts.entries()).map(([code, count], idx) => {
      const plan = plans.find((p) => p.code === code);
      return {
        plan_code: code,
        plan_name: plan?.name || code,
        count,
        color: PLAN_COLORS[idx % PLAN_COLORS.length],
      };
    });
  }, [subscriptions, plans]);

  const statusDistribution: SubscriptionStatusDistributionItem[] = useMemo(() => {
    let active = 0;
    let trial = 0;
    let suspended = 0;
    let other = 0;

    subscriptions.forEach((s) => {
      const st = (s.status || '').toLowerCase();
      if (st === 'active' || st === 'aktif') active++;
      else if (st === 'trial') trial++;
      else if (st === 'suspended' || st === 'ditangguhkan') suspended++;
      else other++;
    });

    return [
      { status: 'active', label: 'Aktif', count: active, tone: 'pine' as const },
      { status: 'trial', label: 'Masa Uji Coba (Trial)', count: trial, tone: 'tide' as const },
      { status: 'suspended', label: 'Ditangguhkan', count: suspended, tone: 'clay' as const },
      { status: 'other', label: 'Lainnya', count: other, tone: 'fog' as const },
    ];
  }, [subscriptions]);

  const refresh = useCallback(async () => {
    setReloadKey((k) => k + 1);
  }, []);

  return {
    context,
    kpis,
    planDistribution,
    statusDistribution,
    recentBusinesses: businesses.slice(0, 5),
    recentSubscriptions: subscriptions.slice(0, 5),
    loading,
    error,
    requestId,
    refresh,
  };
}
