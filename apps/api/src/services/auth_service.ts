import { ApiError } from '../errors/api_error'
import { UserRepository, PublicUser } from '../repositories/user_repository'
import { UserBusinessRepository, UserBusinessMembership } from '../repositories/user_business_repository'
import { verifyPassword } from './password_service'

export interface AuthResult {
  user: PublicUser
  membership?: UserBusinessMembership
}

export interface AuthService {
  authenticateCredentials(email: string, password: string, optionalBusinessId?: string): Promise<AuthResult>
}

export function createAuthService(
  userRepo: UserRepository,
  userBusinessRepo: UserBusinessRepository
): AuthService {
  return {
    async authenticateCredentials(email: string, password: string, optionalBusinessId?: string): Promise<AuthResult> {
      const user = await userRepo.findByEmail(email)

      if (!user) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
      }

      const isPasswordValid = await verifyPassword(password, user.password_hash)

      if (!isPasswordValid) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
      }

      if (user.status !== 'ACTIVE') {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
      }

      // Convert InternalUser to PublicUser by stripping password_hash
      const { password_hash, ...publicUser } = user

      if (optionalBusinessId) {
        const membership = await userBusinessRepo.findActiveMembership(user.id, optionalBusinessId)
        if (!membership) {
          throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Access denied to this business')
        }

        return { user: publicUser, membership }
      }

      return { user: publicUser }
    }
  }
}
