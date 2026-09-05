'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  getDeviceServices,
  createDeviceService,
  updateDeviceService,
  completeDeviceService,
  getDeviceApiErrorMessage,
} from '@/features/devices/api';
import {
  DeviceServiceDto,
  DeviceServiceFilterModel,
  CreateDeviceServicePayload,
  UpdateDeviceServicePayload,
  CompleteDeviceServicePayload,
} from '@/features/devices/types';
import { DeviceServiceToolbar } from '@/features/devices/components/DeviceServiceToolbar';
import { DeviceServiceTable } from '@/features/devices/components/DeviceServiceTable';
import { DeviceServiceCreateModal } from '@/features/devices/components/DeviceServiceCreateModal';
import { DeviceServiceUpdateModal } from '@/features/devices/components/DeviceServiceUpdateModal';
import { DeviceServiceCompleteModal } from '@/features/devices/components/DeviceServiceCompleteModal';

export default function DeviceServicesPage() {
  const { role } = useAuth();
  const canMutate = role === 'OWNER' || role === 'STAFF';

  const [services, setServices] = useState<DeviceServiceDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<DeviceServiceFilterModel>({
    limit: 50,
    offset: 0,
  });

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<DeviceServiceDto | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDeviceServices(filters);
      setServices(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(getDeviceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleFilterChange = (patch: Partial<DeviceServiceFilterModel>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleCreate = async (payload: CreateDeviceServicePayload) => {
    try {
      await createDeviceService(payload);
      showToast('Tiket servis / work order baru berhasil dibuat.');
      loadServices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  const handleUpdate = async (serviceId: string, patch: UpdateDeviceServicePayload) => {
    try {
      await updateDeviceService(serviceId, patch);
      showToast('Status / data work order berhasil diperbarui.');
      loadServices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  const handleComplete = async (serviceId: string, payload: CompleteDeviceServicePayload) => {
    try {
      await completeDeviceService(serviceId, payload);
      showToast('Work order berhasil diselesaikan.');
      loadServices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-pine/30 bg-pine text-white px-4 py-2.5 text-xs font-semibold shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Layanan Servis & Work Order
          </h1>
          <p className="text-xs text-ink/60 mt-0.5">
            Manajemen tiket perbaikan, pemeliharaan, penggantian unit (RMA), dan instalasi teknis perangkat.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <DeviceServiceToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        canMutate={canMutate}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {/* Table */}
      <DeviceServiceTable
        services={services}
        isLoading={isLoading}
        canMutate={canMutate}
        onUpdate={(svc) => {
          setSelectedService(svc);
          setIsUpdateOpen(true);
        }}
        onComplete={(svc) => {
          setSelectedService(svc);
          setIsCompleteOpen(true);
        }}
      />

      {/* Modals */}
      <DeviceServiceCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeviceServiceUpdateModal
        service={selectedService}
        isOpen={isUpdateOpen}
        onClose={() => {
          setIsUpdateOpen(false);
          setSelectedService(null);
        }}
        onConfirmUpdate={handleUpdate}
      />

      <DeviceServiceCompleteModal
        service={selectedService}
        isOpen={isCompleteOpen}
        onClose={() => {
          setIsCompleteOpen(false);
          setSelectedService(null);
        }}
        onConfirmComplete={handleComplete}
      />
    </div>
  );
}
