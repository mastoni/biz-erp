import jwt from 'jsonwebtoken'
import { ApiError } from '../errors/api_error'

export interface AccessTokenClaims {
  sub: string
  business_id: string
  role: 'OWNER' | 'CASHIER'
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
      return jwt.sign(
        {
          sub: claims.sub,
          business_id: claims.business_id,
          role: claims.role,
          session_id: claims.session_id,
          jti: claims.jti
        },
        secret,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer,
          audience
        }
      )
    },

    verifyAccessToken(token: string): AccessTokenClaims {
      try {
        const decoded = jwt.verify(token, secret, {
          algorithms: ['HS256'],
          issuer,
          audience,
          complete: false
        }) as jwt.JwtPayload

        // Strictly validate required claims
        if (!decoded.sub || typeof decoded.sub !== 'string') throw new Error('Missing sub')
        if (!decoded.business_id || typeof decoded.business_id !== 'string') throw new Error('Missing business_id')
        if (!decoded.role || (decoded.role !== 'OWNER' && decoded.role !== 'CASHIER')) throw new Error('Invalid role')
        if (!decoded.session_id || typeof decoded.session_id !== 'string') throw new Error('Missing session_id')
        if (!decoded.jti || typeof decoded.jti !== 'string') throw new Error('Missing jti')

        return {
          sub: decoded.sub,
          business_id: decoded.business_id,
          role: decoded.role as 'OWNER' | 'CASHIER',
          session_id: decoded.session_id,
          jti: decoded.jti,
          iat: decoded.iat,
          exp: decoded.exp,
          iss: decoded.iss,
          aud: Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud
        }
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired')
        }
        throw new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
      }
    }
  }
}
