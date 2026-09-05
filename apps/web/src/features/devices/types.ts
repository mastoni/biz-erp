export type DeviceType =
  | 'POS_TERMINAL'
  | 'PRINTER'
  | 'SCANNER'
  | 'CASH_DRAWER'
  | 'ONT'
  | 'ROUTER'
  | 'ACCESS_POINT'
  | 'CCTV_CAMERA'
  | 'DVR_NVR'
  | 'OTHER';

export type DeviceOwnershipType = 'TENANT_OWNED' | 'CUSTOMER_OWNED' | 'LEASED_RENTED';

export type DeviceStatus =
  | 'IN_STOCK'
  | 'RESERVED'
  | 'INSTALLED'
  | 'IN_REPAIR'
  | 'DEFECTIVE'
  | 'RETURNED'
  | 'DECOMMISSIONED';

export interface DeviceDto {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string | null;
  serial_number: string;
  mac_address: string | null;
  device_type: DeviceType;
  ownership_type: DeviceOwnershipType;
  status: DeviceStatus;
  customer_id: string | null;
  installed_address: string | null;
  installed_at: string | null;
  warranty_months: number | null;
  warranty_expires_at: string | null;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  product_name?: string | null;
  branch_name?: string | null;
  customer_name?: string | null;
}

export interface DeviceServiceSummaryItemDto {
  id: string;
  service_type: DeviceServiceType;
  status: DeviceServiceStatus;
  technician_name: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  findings: string | null;
  action_taken: string | null;
  created_at: string;
}

export interface DeviceDetailDto extends DeviceDto {
  product_name?: string | null;
  branch_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  services: DeviceServiceSummaryItemDto[];
}

export interface DeviceSummaryDto {
  total: number;
  in_stock: number;
  reserved: number;
  installed: number;
  in_repair: number;
  defective: number;
  returned: number;
  decommissioned: number;
}

export interface DeviceListResponse {
  items: DeviceDto[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  summary?: DeviceSummaryDto;
}

export interface CreateDevicePayload {
  branch_id: string;
  product_id?: string | null;
  serial_number: string;
  mac_address?: string | null;
  device_type: DeviceType;
  ownership_type?: DeviceOwnershipType;
  status?: DeviceStatus;
  customer_id?: string | null;
  installed_address?: string | null;
  installed_at?: string | null;
  warranty_months?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  sync_inventory?: boolean;
}

export interface BulkCreateDevicePayload {
  branch_id: string;
  device_type: DeviceType;
  product_id?: string | null;
  ownership_type?: DeviceOwnershipType;
  warranty_months?: number | null;
  metadata?: Record<string, unknown>;
  sync_inventory?: boolean;
  items: Array<{
    serial_number: string;
    mac_address?: string | null;
    notes?: string | null;
  }>;
}

export interface UpdateDevicePayload {
  branch_id?: string;
  product_id?: string | null;
  mac_address?: string | null;
  warranty_months?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AssignDevicePayload {
  customer_id: string;
  installed_address?: string | null;
  installed_at?: string | null;
  notes?: string | null;
}

export interface UnassignDevicePayload {
  return_status?: 'IN_STOCK' | 'DEFECTIVE' | 'RETURNED' | 'DECOMMISSIONED';
  notes?: string | null;
}

export interface DeviceFilterModel {
  branch_id?: string;
  customer_id?: string;
  product_id?: string;
  device_type?: string;
  status?: string;
  ownership_type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export type DeviceServiceType =
  | 'INSTALLATION'
  | 'MAINTENANCE'
  | 'REPAIR'
  | 'REPLACEMENT'
  | 'DECOMMISSION';

export type DeviceServiceStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface DeviceServiceDto {
  id: string;
  business_id: string;
  device_id: string;
  customer_id: string | null;
  service_type: DeviceServiceType;
  status: DeviceServiceStatus;
  technician_name: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  replacement_device_id: string | null;
  findings: string | null;
  action_taken: string | null;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  device_serial?: string | null;
  device_type?: DeviceType | null;
  customer_name?: string | null;
  replacement_serial?: string | null;
}

export interface DeviceServiceDetailDto extends DeviceServiceDto {
  device_serial?: string | null;
  device_type?: DeviceType | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  replacement_serial?: string | null;
}

export interface DeviceServiceListResponse {
  items: DeviceServiceDto[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface CreateDeviceServicePayload {
  device_id: string;
  customer_id?: string | null;
  service_type: DeviceServiceType;
  status?: DeviceServiceStatus;
  technician_name?: string | null;
  scheduled_at?: string | null;
  replacement_device_id?: string | null;
  findings?: string | null;
  action_taken?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDeviceServicePayload {
  status?: DeviceServiceStatus;
  technician_name?: string | null;
  scheduled_at?: string | null;
  replacement_device_id?: string | null;
  findings?: string | null;
  action_taken?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CompleteDeviceServicePayload {
  findings?: string | null;
  action_taken?: string | null;
  notes?: string | null;
  replacement_device_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DeviceServiceFilterModel {
  device_id?: string;
  customer_id?: string;
  service_type?: string;
  status?: string;
  technician_name?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}
