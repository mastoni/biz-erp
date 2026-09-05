'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import {
  getDeviceServiceDetail,
  updateDeviceService,
  completeDeviceService,
  getDeviceApiErrorMessage,
} from '@/features/devices/api';
import {
  DeviceServiceDetailDto,
  UpdateDeviceServicePayload,
  CompleteDeviceServicePayload,
} from '@/features/devices/types';
import { DeviceServiceDetailView } from '@/features/devices/components/DeviceServiceDetailView';
import { DeviceServiceUpdateModal } from '@/features/devices/components/DeviceServiceUpdateModal';
import { DeviceServiceCompleteModal } from '@/features/devices/components/DeviceServiceCompleteModal';

export default function DeviceServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { role } = useAuth();
  const canMutate = role === 'OWNER' || role === 'STAFF';

  const [service, setService] = useState<DeviceServiceDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDeviceServiceDetail(id);
      setService(data);
    } catch (err) {
      setError(getDeviceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleUpdate = async (serviceId: string, patch: UpdateDeviceServicePayload) => {
    try {
      await updateDeviceService(serviceId, patch);
      showToast('Data work order berhasil diperbarui.');
      loadDetail();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  const handleComplete = async (serviceId: string, payload: CompleteDeviceServicePayload) => {
    try {
      await completeDeviceService(serviceId, payload);
      showToast('Work order berhasil diselesaikan.');
      loadDetail();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent dark:border-emerald-400" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
          {error || 'Tiket layanan tidak ditemukan.'}
        </div>
        <button
          type="button"
          onClick={() => router.push('/device-services')}
          className="rounded-xl border border-ink/20 px-3.5 py-2 text-xs font-semibold text-ink hover:bg-ink/5"
        >
          Kembali ke Daftar Layanan Servis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-pine/30 bg-pine text-white px-4 py-2.5 text-xs font-semibold shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      <DeviceServiceDetailView
        service={service}
        canMutate={canMutate}
        onUpdate={() => setIsUpdateOpen(true)}
        onComplete={() => setIsCompleteOpen(true)}
      />

      <DeviceServiceUpdateModal
        service={service}
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        onConfirmUpdate={handleUpdate}
      />

      <DeviceServiceCompleteModal
        service={service}
        isOpen={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        onConfirmComplete={handleComplete}
      />
    </div>
  );
}
