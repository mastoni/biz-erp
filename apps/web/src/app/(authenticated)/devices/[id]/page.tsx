'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import {
  getDeviceDetail,
  updateDevice,
  assignDevice,
  unassignDevice,
  createDeviceService,
  getDeviceApiErrorMessage,
} from '@/features/devices/api';
import {
  DeviceDetailDto,
  UpdateDevicePayload,
  AssignDevicePayload,
  UnassignDevicePayload,
  CreateDeviceServicePayload,
} from '@/features/devices/types';
import { DeviceDetailView } from '@/features/devices/components/DeviceDetailView';
import { DeviceAssignModal } from '@/features/devices/components/DeviceAssignModal';
import { DeviceUnassignModal } from '@/features/devices/components/DeviceUnassignModal';
import { DeviceUpdateModal } from '@/features/devices/components/DeviceUpdateModal';
import { DeviceServiceCreateModal } from '@/features/devices/components/DeviceServiceCreateModal';

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { role, business } = useAuth();
  const canMutate = role === 'OWNER' || role === 'STAFF';

  const [device, setDevice] = useState<DeviceDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isUnassignOpen, setIsUnassignOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);

  // Auxiliary data for dropdowns
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone?: string }>>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    if (!business?.id) return;
    api
      .get<{ items: Array<{ id: string; name: string; phone?: string }> }>('/v1/customers', {
        params: { business_id: business.id },
      })
      .then((res) => setCustomers(res.data.items || []))
      .catch(() => {});
  }, [business?.id]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDeviceDetail(id);
      setDevice(data);
    } catch (err) {
      setError(getDeviceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleUpdate = async (deviceId: string, patch: UpdateDevicePayload) => {
    try {
      await updateDevice(deviceId, patch);
      showToast('Data perangkat berhasil diperbarui.');
      loadDetail();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  const handleAssign = async (deviceId: string, payload: AssignDevicePayload) => {
    try {
      const updated = await assignDevice(deviceId, payload);
      showToast(`Perangkat "${updated.serial_number}" berhasil dipasang ke pelanggan.`);
      loadDetail();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  const handleUnassign = async (deviceId: string, payload: UnassignDevicePayload) => {
    try {
      const updated = await unassignDevice(deviceId, payload);
      showToast(`Perangkat "${updated.serial_number}" berhasil ditarik.`);
      loadDetail();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  const handleCreateService = async (payload: CreateDeviceServicePayload) => {
    try {
      const created = await createDeviceService(payload);
      showToast('Tiket servis / work order berhasil dibuat.');
      loadDetail();
      router.push(`/device-services/${created.id}`);
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

  if (error || !device) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
          {error || 'Perangkat tidak ditemukan.'}
        </div>
        <button
          type="button"
          onClick={() => router.push('/devices')}
          className="rounded-xl border border-ink/20 px-3.5 py-2 text-xs font-semibold text-ink hover:bg-ink/5"
        >
          Kembali ke Daftar Perangkat
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

      <DeviceDetailView
        device={device}
        canMutate={canMutate}
        onAssign={() => setIsAssignOpen(true)}
        onUnassign={() => setIsUnassignOpen(true)}
        onEdit={() => setIsUpdateOpen(true)}
        onCreateService={() => setIsCreateServiceOpen(true)}
      />

      <DeviceAssignModal
        device={device}
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        customers={customers}
        onConfirmAssign={handleAssign}
      />

      <DeviceUnassignModal
        device={device}
        isOpen={isUnassignOpen}
        onClose={() => setIsUnassignOpen(false)}
        onConfirmUnassign={handleUnassign}
      />

      <DeviceUpdateModal
        device={device}
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        onConfirmUpdate={handleUpdate}
      />

      <DeviceServiceCreateModal
        initialDeviceId={device.id}
        initialCustomerId={device.customer_id || undefined}
        isOpen={isCreateServiceOpen}
        onClose={() => setIsCreateServiceOpen(false)}
        onSubmit={handleCreateService}
      />
    </div>
  );
}
