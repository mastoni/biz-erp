'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useBranchContext } from '@/features/branches/BranchContext';
import {
  getDevices,
  createDevice,
  createBulkDevices,
  updateDevice,
  assignDevice,
  unassignDevice,
  getDeviceApiErrorMessage,
} from '@/features/devices/api';
import { api } from '@/lib/api';
import {
  DeviceDto,
  DeviceFilterModel,
  DeviceSummaryDto,
  CreateDevicePayload,
  BulkCreateDevicePayload,
  UpdateDevicePayload,
  AssignDevicePayload,
  UnassignDevicePayload,
} from '@/features/devices/types';
import { DeviceKPICards } from '@/features/devices/components/DeviceKPICards';
import { DeviceToolbar } from '@/features/devices/components/DeviceToolbar';
import { DeviceTable } from '@/features/devices/components/DeviceTable';
import { DeviceRegisterModal } from '@/features/devices/components/DeviceRegisterModal';
import { DeviceAssignModal } from '@/features/devices/components/DeviceAssignModal';
import { DeviceUnassignModal } from '@/features/devices/components/DeviceUnassignModal';
import { DeviceUpdateModal } from '@/features/devices/components/DeviceUpdateModal';

export default function DevicesPage() {
  const { role, business } = useAuth();
  const { activeBranch } = useBranchContext();

  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [summary, setSummary] = useState<DeviceSummaryDto | undefined>();
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<DeviceFilterModel>({
    limit: 50,
    offset: 0,
  });

  // Modal states
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isUnassignOpen, setIsUnassignOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDto | null>(null);

  // Aux dropdown data
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone?: string }>>([]);

  const canMutate = role === 'OWNER' || role === 'STAFF';
  const branchId = activeBranch?.id || '';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Load auxiliary data
  useEffect(() => {
    if (!business?.id) return;

    // Branches
    api
      .get<{ items: Array<{ id: string; name: string }> }>('/v1/branches', {
        params: { business_id: business.id },
      })
      .then((res) => setBranches(res.data.items || []))
      .catch(() => {});

    // Products
    api
      .get<{ items: Array<{ id: string; name: string }> }>('/v1/products', {
        params: { business_id: business.id },
      })
      .then((res) => setProducts(res.data.items || []))
      .catch(() => {});

    // Customers
    api
      .get<{ items: Array<{ id: string; name: string; phone?: string }> }>('/v1/customers', {
        params: { business_id: business.id },
      })
      .then((res) => setCustomers(res.data.items || []))
      .catch(() => {});
  }, [business?.id]);

  // Load devices list
  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDevices(filters);
      setDevices(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary);
    } catch (err) {
      setError(getDeviceApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleFilterChange = (patch: Partial<DeviceFilterModel>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  // Handler for Single Device Registration
  const handleRegisterSingle = async (payload: CreateDevicePayload) => {
    try {
      const created = await createDevice(payload);
      showToast(`Perangkat "${created.serial_number}" berhasil didaftarkan.`);
      loadDevices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  // Handler for Bulk Device Registration
  const handleRegisterBulk = async (payload: BulkCreateDevicePayload) => {
    try {
      const created = await createBulkDevices(payload);
      showToast(`${created.length} unit perangkat berhasil didaftarkan.`);
      loadDevices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  // Handler for Device Update
  const handleUpdate = async (deviceId: string, patch: UpdateDevicePayload) => {
    try {
      await updateDevice(deviceId, patch);
      showToast('Data perangkat berhasil diperbarui.');
      loadDevices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  // Handler for Device Assign
  const handleAssign = async (deviceId: string, payload: AssignDevicePayload) => {
    try {
      const updated = await assignDevice(deviceId, payload);
      showToast(`Perangkat "${updated.serial_number}" berhasil dipasang ke pelanggan.`);
      loadDevices();
    } catch (err) {
      throw new Error(getDeviceApiErrorMessage(err));
    }
  };

  // Handler for Device Unassign
  const handleUnassign = async (deviceId: string, payload: UnassignDevicePayload) => {
    try {
      const updated = await unassignDevice(deviceId, payload);
      showToast(`Perangkat "${updated.serial_number}" berhasil ditarik (status: ${updated.status}).`);
      loadDevices();
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
            Perangkat Hardware
          </h1>
          <p className="text-xs text-ink/60 mt-0.5">
            Manajemen aset perangkat fisik, nomor seri, MAC address, garansi, dan alokasi pelanggan.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <DeviceKPICards summary={summary} isLoading={isLoading} />

      {/* Error Alert if any */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <DeviceToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        canMutate={canMutate}
        onOpenRegisterSingle={() => setIsRegisterOpen(true)}
        onOpenRegisterBulk={() => setIsRegisterOpen(true)}
      />

      {/* Devices List Table */}
      <DeviceTable
        devices={devices}
        isLoading={isLoading}
        canMutate={canMutate}
        onAssign={(dev) => {
          setSelectedDevice(dev);
          setIsAssignOpen(true);
        }}
        onUnassign={(dev) => {
          setSelectedDevice(dev);
          setIsUnassignOpen(true);
        }}
        onEdit={(dev) => {
          setSelectedDevice(dev);
          setIsUpdateOpen(true);
        }}
      />

      {/* Modals for Registration, Assignment, Unassignment, and Updating */}
      <DeviceRegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        branchId={branchId}
        branches={branches}
        products={products}
        onSubmitSingle={handleRegisterSingle}
        onSubmitBulk={handleRegisterBulk}
      />

      <DeviceAssignModal
        device={selectedDevice}
        isOpen={isAssignOpen}
        onClose={() => {
          setIsAssignOpen(false);
          setSelectedDevice(null);
        }}
        customers={customers}
        onConfirmAssign={handleAssign}
      />

      <DeviceUnassignModal
        device={selectedDevice}
        isOpen={isUnassignOpen}
        onClose={() => {
          setIsUnassignOpen(false);
          setSelectedDevice(null);
        }}
        onConfirmUnassign={handleUnassign}
      />

      <DeviceUpdateModal
        device={selectedDevice}
        isOpen={isUpdateOpen}
        onClose={() => {
          setIsUpdateOpen(false);
          setSelectedDevice(null);
        }}
        onConfirmUpdate={handleUpdate}
      />
    </div>
  );
}
