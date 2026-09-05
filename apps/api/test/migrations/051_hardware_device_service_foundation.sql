-- Phase 4.1.40G: Hardware & Device Service Foundation
-- Establishes the tenant-scoped serialized hardware asset registry (devices)
-- and technical field service records (device_services).

-- 1. DEVICES TABLE (Serialized Physical Assets)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    serial_number TEXT NOT NULL,
    mac_address TEXT,
    device_type TEXT NOT NULL CHECK (device_type IN (
        'POS_TERMINAL', 'PRINTER', 'SCANNER', 'CASH_DRAWER',
        'ONT', 'ROUTER', 'ACCESS_POINT', 'CCTV_CAMERA', 'DVR_NVR', 'OTHER'
    )),
    ownership_type TEXT NOT NULL DEFAULT 'TENANT_OWNED' CHECK (ownership_type IN ('TENANT_OWNED', 'CUSTOMER_OWNED', 'LEASED_RENTED')),
    status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN (
        'IN_STOCK', 'RESERVED', 'INSTALLED', 'IN_REPAIR', 'DEFECTIVE', 'RETURNED', 'DECOMMISSIONED'
    )),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    installed_address TEXT,
    installed_at TIMESTAMPTZ,
    warranty_months INTEGER DEFAULT 12 CHECK (warranty_months IS NULL OR warranty_months >= 0),
    warranty_expires_at DATE,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Normalization check constraints
    CONSTRAINT chk_devices_serial_normalized CHECK (
        length(trim(serial_number)) > 0 AND serial_number = upper(trim(serial_number))
    ),
    CONSTRAINT chk_devices_mac_normalized CHECK (
        mac_address IS NULL OR mac_address ~ '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    ),
    
    -- Tenant isolation composite unique constraints
    CONSTRAINT uq_devices_business_serial UNIQUE (business_id, serial_number),
    CONSTRAINT uq_devices_id_business UNIQUE (id, business_id)
);

-- Partial unique index for MAC address per tenant (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_business_mac 
    ON devices (business_id, mac_address) 
    WHERE mac_address IS NOT NULL AND mac_address != '';

-- Performance indexes for devices
CREATE INDEX IF NOT EXISTS idx_devices_business_id ON devices(business_id);
CREATE INDEX IF NOT EXISTS idx_devices_business_branch ON devices(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_devices_business_customer ON devices(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_devices_business_status ON devices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_business_type ON devices(business_id, device_type);
CREATE INDEX IF NOT EXISTS idx_devices_business_product ON devices(business_id, product_id);

-- 2. DEVICE_SERVICES TABLE (Installation & Maintenance Work Orders)
CREATE TABLE IF NOT EXISTS device_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('INSTALLATION', 'MAINTENANCE', 'REPAIR', 'REPLACEMENT', 'DECOMMISSION')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    technician_name TEXT,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    replacement_device_id UUID,
    findings TEXT,
    action_taken TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Composite tenant integrity foreign keys (ensures device belongs to the same business_id)
    CONSTRAINT fk_device_services_device FOREIGN KEY (device_id, business_id)
        REFERENCES devices(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_device_services_replacement_device FOREIGN KEY (replacement_device_id, business_id)
        REFERENCES devices(id, business_id) ON DELETE SET NULL
);

-- Performance indexes for device_services
CREATE INDEX IF NOT EXISTS idx_device_services_business_id ON device_services(business_id);
CREATE INDEX IF NOT EXISTS idx_device_services_business_device ON device_services(business_id, device_id);
CREATE INDEX IF NOT EXISTS idx_device_services_business_customer ON device_services(business_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_device_services_business_status ON device_services(business_id, status);
CREATE INDEX IF NOT EXISTS idx_device_services_business_type ON device_services(business_id, service_type);
CREATE INDEX IF NOT EXISTS idx_device_services_replacement_device ON device_services(replacement_device_id);

-- 3. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_device_services_updated_at ON device_services;
CREATE TRIGGER update_device_services_updated_at
BEFORE UPDATE ON device_services
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
