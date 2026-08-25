import { Pool } from 'pg'
import { BranchCreateRequest, BranchDto } from '../dto/branch_dto'
import { branchRepository } from '../repositories/branch_repository'
import { withTransaction } from '../db/transaction'
import { ApiError } from '../errors/api_error'

export class BranchService {
  constructor(private readonly pool: Pool) {}

  async listBranches(businessId: string): Promise<BranchDto[]> {
    const client = await this.pool.connect()
    try {
      return await branchRepository.findAll(client, businessId)
    } finally {
      client.release()
    }
  }

  async createBranch(businessId: string, data: BranchCreateRequest): Promise<BranchDto> {
    if (data.business_id !== businessId) {
      throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch')
    }

    return await withTransaction(this.pool, async (client) => {
      const existing = await branchRepository.findByName(client, businessId, data.name)
      if (existing) {
        throw new ApiError(409, 'CONFLICT', 'Branch name already exists in this business')
      }

      return await branchRepository.create(client, data)
    })
  }

  async getBranchById(businessId: string, branchId: string): Promise<BranchDto | null> {
    const client = await this.pool.connect()
    try {
      return await branchRepository.findById(client, businessId, branchId)
    } finally {
      client.release()
    }
  }
}
