export interface Branch {
  id: string;
  business_id: string;
  name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchListResponse {
  items: Branch[];
}

export interface Stock {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  server_version: number;
  created_at: string;
  updated_at: string;
}

export interface StockListResponse {
  items: Stock[];
}

export interface StockMovement {
  id: string;
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  movement_type: string;
  reference: string | null;
  actor: string;
  timestamp: string;
}

export interface MovementListResponse {
  items: StockMovement[];
}

export interface StockAdjustmentPayload {
  business_id: string;
  branch_id: string;
  product_id: string;
  quantity_change: number;
  expected_server_version: number;
  reference?: string | null;
}

export interface StockAdjustmentResponse {
  stock: Stock;
  movement: StockMovement;
}
