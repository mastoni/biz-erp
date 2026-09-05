import { api } from '@/lib/api';
import axios from 'axios';
import {
  DeviceDto,
  DeviceDetailDto,
  DeviceListResponse,
  CreateDevicePayload,
  BulkCreateDevicePayload,
  UpdateDevicePayload,
  AssignDevicePayload,
  UnassignDevicePayload,
  DeviceFilterModel,
  DeviceServiceDto,
  DeviceServiceDetailDto,
  DeviceServiceListResponse,
  CreateDeviceServicePayload,
  UpdateDeviceServicePayload,
  CompleteDeviceServicePayload,
  DeviceServiceFilterModel,
} from './types';

export function getDeviceApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      return error.response.data?.message || 'Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.';
    }
    if (error.response?.status === 404) {
      return error.response.data?.message || 'Data tidak ditemukan dalam konteks bisnis Anda.';
    }
    if (error.response?.status === 409) {
      return error.response.data?.message || 'Terjadi konflik status atau nomor seri/MAC duplikat.';
    }
    if (error.response?.status === 400) {
      return error.response.data?.message || 'Format data tidak valid. Periksa kembali isian form Anda.';
    }
    return error.response?.data?.message || error.message || 'Terjadi kesalahan sistem';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Terjadi kesalahan sistem yang tidak diketahui';
}

// =========================================================================
// DEVICE API CALLS
// =========================================================================

export async function getDevices(filters: DeviceFilterModel = {}): Promise<DeviceListResponse> {
  const response = await api.get<DeviceListResponse>('/v1/devices', {
    params: {
      ...(filters.branch_id ? { branch_id: filters.branch_id } : {}),
      ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
      ...(filters.product_id ? { product_id: filters.product_id } : {}),
      ...(filters.device_type ? { device_type: filters.device_type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownership_type ? { ownership_type: filters.ownership_type } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
    },
  });
  return response.data;
}

export async function getDeviceDetail(deviceId: string): Promise<DeviceDetailDto> {
  const response = await api.get<DeviceDetailDto>(`/v1/devices/${deviceId}`);
  return response.data;
}

export async function createDevice(payload: CreateDevicePayload): Promise<DeviceDto> {
  const response = await api.post<DeviceDto>('/v1/devices', payload);
  return response.data;
}

export async function createBulkDevices(payload: BulkCreateDevicePayload): Promise<DeviceDto[]> {
  const response = await api.post<DeviceDto[]>('/v1/devices', payload);
  return response.data;
}

export async function updateDevice(deviceId: string, patch: UpdateDevicePayload): Promise<DeviceDto> {
  const response = await api.patch<DeviceDto>(`/v1/devices/${deviceId}`, patch);
  return response.data;
}

export async function assignDevice(deviceId: string, payload: AssignDevicePayload): Promise<DeviceDto> {
  const response = await api.post<DeviceDto>(`/v1/devices/${deviceId}/assign`, payload);
  return response.data;
}

export async function unassignDevice(deviceId: string, payload: UnassignDevicePayload): Promise<DeviceDto> {
  const response = await api.post<DeviceDto>(`/v1/devices/${deviceId}/unassign`, payload);
  return response.data;
}

// =========================================================================
// DEVICE SERVICE / WORK ORDER API CALLS
// =========================================================================

export async function getDeviceServices(filters: DeviceServiceFilterModel = {}): Promise<DeviceServiceListResponse> {
  const response = await api.get<DeviceServiceListResponse>('/v1/device-services', {
    params: {
      ...(filters.device_id ? { device_id: filters.device_id } : {}),
      ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
      ...(filters.service_type ? { service_type: filters.service_type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.technician_name ? { technician_name: filters.technician_name } : {}),
      ...(filters.from_date ? { from_date: filters.from_date } : {}),
      ...(filters.to_date ? { to_date: filters.to_date } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
    },
  });
  return response.data;
}

export async function getDeviceServiceDetail(serviceId: string): Promise<DeviceServiceDetailDto> {
  const response = await api.get<DeviceServiceDetailDto>(`/v1/device-services/${serviceId}`);
  return response.data;
}

export async function createDeviceService(payload: CreateDeviceServicePayload): Promise<DeviceServiceDto> {
  const response = await api.post<DeviceServiceDto>('/v1/device-services', payload);
  return response.data;
}

export async function updateDeviceService(
  serviceId: string,
  patch: UpdateDeviceServicePayload
): Promise<DeviceServiceDto> {
  const response = await api.patch<DeviceServiceDto>(`/v1/device-services/${serviceId}`, patch);
  return response.data;
}

export async function completeDeviceService(
  serviceId: string,
  payload: CompleteDeviceServicePayload
): Promise<DeviceServiceDto> {
  const response = await api.post<DeviceServiceDto>(`/v1/device-services/${serviceId}/complete`, payload);
  return response.data;
}
