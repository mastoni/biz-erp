-- Phase 4.1.40D: ISP Management & Network Device Foundation

-- 1. ISP Gateways (Routers, BNGs, ACS Controllers, Mesh Controllers)
CREATE TABLE IF NOT EXISTS isp_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('MIKROTIK', 'GENIEACS', 'OPENWISP', 'RADIUS')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  use_tls BOOLEAN NOT NULL DEFAULT TRUE,
  auth_username TEXT,
  auth_secret_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_isp_gateways_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_isp_gateways_business_id ON isp_gateways(business_id);
CREATE INDEX IF NOT EXISTS idx_isp_gateways_type ON isp_gateways(gateway_type);

-- 2. ISP Subscribers (Multi-Gateway Architecture with Composite Tenant FKs)
CREATE TABLE IF NOT EXISTS isp_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  
  -- Multi-Gateway References with Composite Tenant Integrity Constraints
  network_gateway_id UUID NOT NULL,
  acs_gateway_id UUID,
  mesh_gateway_id UUID,

  pppoe_username TEXT NOT NULL,
  pppoe_password_encrypted TEXT NOT NULL,
  ip_address TEXT,
  ont_serial_number TEXT,
  ont_vlan INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION' CHECK (status IN ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Database-enforced Tenant FK Integrity
  CONSTRAINT fk_isp_sub_network_gw FOREIGN KEY (network_gateway_id, business_id)
    REFERENCES isp_gateways(id, business_id) ON DELETE RESTRICT,
  CONSTRAINT fk_isp_sub_acs_gw FOREIGN KEY (acs_gateway_id, business_id)
    REFERENCES isp_gateways(id, business_id) ON DELETE SET NULL,
  CONSTRAINT fk_isp_sub_mesh_gw FOREIGN KEY (mesh_gateway_id, business_id)
    REFERENCES isp_gateways(id, business_id) ON DELETE SET NULL,

  CONSTRAINT uq_isp_network_pppoe_username UNIQUE (network_gateway_id, pppoe_username)
);

CREATE INDEX IF NOT EXISTS idx_isp_subscribers_business_id ON isp_subscribers(business_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_customer_id ON isp_subscribers(customer_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_network_gw ON isp_subscribers(network_gateway_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_acs_gw ON isp_subscribers(acs_gateway_id);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_ont_serial ON isp_subscribers(ont_serial_number);
CREATE INDEX IF NOT EXISTS idx_isp_subscribers_status ON isp_subscribers(status);
