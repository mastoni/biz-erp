import jwt from 'jsonwebtoken'
import { ApiError } from '../errors/api_error'

export type TokenScope = 'tenant' | 'platform'
export type TenantRole = 'OWNER' | 'CASHIER'
export type PlatformRole = 'PLATFORM_ADMIN' | 'SUPER_ADMIN'
export type TokenRole = TenantRole | PlatformRole

export interface AccessTokenClaims {
  sub: string
  scope?: TokenScope
  business_id?: string
  role: TokenRole
  session_id: string
  jti: string
  iat?: number
  exp?: number
  iss?: string
  aud?: string
}

export interface JwtService {
  signAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss' | 'aud'>): string
  verifyAccessToken(token: string): AccessTokenClaims
}

export function createJwtService(
  secret: string,
  issuer: string,
  audience: string
): JwtService {
  if (!secret || secret.length < 32) {
    throw new Error('A strong JWT secret (at least 32 characters) must be provided.')
  }

  return {
    signAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss' | 'aud'>): string {
      // New tokens always carry an explicit scope. Legacy callers that omit it
      // are defaulted to 'tenant' so existing issuance keeps working unchanged.
      const scope: TokenScope = claims.scope ?? 'tenant'

      const payload: Record<string, unknown> = {
        sub: claims.sub,
        scope,
        role: claims.role,
        session_id: claims.session_id,
        jti: claims.jti
      }

      // Platform tokens MUST NOT carry a business_id. Omit the claim entirely
      // (never use null).
      if (claims.business_id) {
        payload.business_id = claims.business_id
      }

      return jwt.sign(payload, secret, {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer,
        audience
      })
    },

    verifyAccessToken(token: string): AccessTokenClaims {
      try {
        const decoded = jwt.verify(token, secret, {
          algorithms: ['HS256'],
          issuer,
          audience,
          complete: false
        }) as jwt.JwtPayload

        // Strictly validate base required claims
        if (!decoded.sub || typeof decoded.sub !== 'string') throw new Error('Missing sub')
        if (!decoded.session_id || typeof decoded.session_id !== 'string') throw new Error('Missing session_id')
        if (!decoded.jti || typeof decoded.jti !== 'string') throw new Error('Missing jti')
        if (!decoded.role || typeof decoded.role !== 'string') throw new Error('Missing role')

        // Explicit scope, or legacy default to tenant. A legacy token MUST NEVER
        // be upgraded to platform scope.
        const scope: TokenScope = decoded.scope === 'platform' ? 'platform' : 'tenant'

        if (scope === 'platform') {
          if (decoded.business_id) {
            throw new ApiError(403, 'INVALID_PLATFORM_TOKEN', 'Platform token must not contain a business_id')
          }
          if (decoded.role !== 'PLATFORM_ADMIN' && decoded.role !== 'SUPER_ADMIN') {
            throw new ApiError(403, 'FORBIDDEN', 'Insufficient platform permissions')
          }
          return {
            sub: decoded.sub,
            scope,
            role: decoded.role as TokenRole,
            session_id: decoded.session_id,
            jti: decoded.jti,
            iat: decoded.iat,
            exp: decoded.exp,
            iss: decoded.iss,
            aud: Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud
          }
        }

        // tenant scope (explicit or legacy)
        if (!decoded.business_id || typeof decoded.business_id !== 'string') {
          throw new Error('Missing business_id')
        }
        if (decoded.role !== 'OWNER' && decoded.role !== 'CASHIER') {
          throw new Error('Invalid tenant role')
        }
        return {
          sub: decoded.sub,
          scope,
          business_id: decoded.business_id,
          role: decoded.role as TokenRole,
          session_id: decoded.session_id,
          jti: decoded.jti,
          iat: decoded.iat,
          exp: decoded.exp,
          iss: decoded.iss,
          aud: Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud
        }
      } catch (err: any) {
        if (err instanceof ApiError) {
          throw err
        }
        if (err.name === 'TokenExpiredError') {
          throw new ApiError(401, 'INVALID_TOKEN', 'Access token has expired')
        }
        throw new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
      }
    }
  }
}
