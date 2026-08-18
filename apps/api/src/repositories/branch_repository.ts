import { PoolClient } from 'pg'
import { BranchDto, BranchCreateRequest } from '../dto/branch_dto'

export const branchRepository = {
  async create(client: PoolClient, data: BranchCreateRequest): Promise<BranchDto> {
    const status = data.status !== undefined ? data.status : true
    const sql = `
      INSERT INTO branches (id, business_id, name, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      RETURNING id, business_id, name, status, created_at, updated_at
    `
    const result = await client.query(sql, [data.id, data.business_id, data.name, status])
    return result.rows[0] as BranchDto
  },

  async findAll(client: PoolClient, businessId: string): Promise<BranchDto[]> {
    const sql = `
      SELECT id, business_id, name, status, created_at, updated_at
      FROM branches
      WHERE business_id = $1
      ORDER BY created_at DESC
    `
    const result = await client.query(sql, [businessId])
    return result.rows as BranchDto[]
  },
  
  async findById(client: PoolClient, businessId: string, branchId: string): Promise<BranchDto | null> {
    const sql = `
      SELECT id, business_id, name, status, created_at, updated_at
      FROM branches
      WHERE business_id = $1 AND id = $2
    `
    const result = await client.query(sql, [businessId, branchId])
    return (result.rows[0] as BranchDto | undefined) ?? null
  }
}
