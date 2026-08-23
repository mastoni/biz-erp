import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createJwtService } from '../src/services/jwt_service'
import { ApiError } from '../src/errors/api_error'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

describe('Phase 4.0.3 JWT Access Token Foundation', () => {
  const secret = 'supersecretkeythatisatleast32characterslong'
  const issuer = 'biz-erp-api'
  const audience = 'biz-erp-client'
  
  const jwtService = createJwtService(secret, issuer, audience)
  
  const validClaims = {
    sub: randomUUID(),
    business_id: randomUUID(),
    role: 'OWNER' as const,
    session_id: randomUUID(),
    jti: randomUUID()
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('AUTH-J001 valid token verifies', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded).toBeDefined()
  })

  it('AUTH-J002 token contains expected subject', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.sub).toBe(validClaims.sub)
  })

  it('AUTH-J003 business_id claim correct', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.business_id).toBe(validClaims.business_id)
  })

  it('AUTH-J004 role claim correct', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.role).toBe(validClaims.role)
  })

  it('AUTH-J005 session_id claim correct', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.session_id).toBe(validClaims.session_id)
  })

  it('AUTH-J006 jti exists', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    expect(decoded.jti).toBe(validClaims.jti)
  })

  it('AUTH-J007 expired token rejected', () => {
    const token = jwtService.signAccessToken(validClaims)
    
    // Advance time by 16 minutes (15m expiration)
    vi.advanceTimersByTime(16 * 60 * 1000)

    expect(() => jwtService.verifyAccessToken(token)).toThrowError(
      new ApiError(401, 'INVALID_TOKEN', 'Access token has expired')
    )
  })

  it('AUTH-J008 wrong secret/signing key rejected', () => {
    const wrongJwtService = createJwtService('anothersecretkeythatisatleast32characterslong', issuer, audience)
    const token = wrongJwtService.signAccessToken(validClaims)

    expect(() => jwtService.verifyAccessToken(token)).toThrowError(
      new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    )
  })

  it('AUTH-J009 wrong issuer rejected', () => {
    const wrongJwtService = createJwtService(secret, 'wrong-issuer', audience)
    const token = wrongJwtService.signAccessToken(validClaims)

    expect(() => jwtService.verifyAccessToken(token)).toThrowError(
      new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    )
  })

  it('AUTH-J010 wrong audience rejected', () => {
    const wrongJwtService = createJwtService(secret, issuer, 'wrong-audience')
    const token = wrongJwtService.signAccessToken(validClaims)

    expect(() => jwtService.verifyAccessToken(token)).toThrowError(
      new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    )
  })

  it('AUTH-J011 malformed token rejected', () => {
    expect(() => jwtService.verifyAccessToken('not.a.real.token')).toThrowError(
      new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    )
  })

  it('AUTH-J012 missing required claim rejected', () => {
    // Manually sign a token without business_id
    const token = jwt.sign(
      {
        sub: validClaims.sub,
        role: validClaims.role,
        session_id: validClaims.session_id,
        jti: validClaims.jti
      },
      secret,
      { algorithm: 'HS256', expiresIn: '15m', issuer, audience }
    )

    expect(() => jwtService.verifyAccessToken(token)).toThrowError(
      new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    )
  })

  it('AUTH-J013 token lifetime approximately 15 minutes', () => {
    const token = jwtService.signAccessToken(validClaims)
    const decoded = jwtService.verifyAccessToken(token)
    
    expect(decoded.iat).toBeDefined()
    expect(decoded.exp).toBeDefined()
    
    const diffInSeconds = decoded.exp! - decoded.iat!
    expect(diffInSeconds).toBe(15 * 60)
  })

  it('AUTH-J014 raw token not logged', () => {
    // This is more of an architectural/code-review assertion, but we can verify our service
    // does not output logs using console.log
    const logSpy = vi.spyOn(console, 'log')
    const token = jwtService.signAccessToken(validClaims)
    try {
      jwtService.verifyAccessToken(token)
      jwtService.verifyAccessToken('invalid.token')
    } catch {}
    
    expect(logSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
