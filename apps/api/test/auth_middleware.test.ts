import { describe, expect, it, vi } from 'vitest'
import { NextFunction, Response } from 'express'
import { createJwtAuthMiddleware, AuthenticatedJwtRequest } from '../src/middleware/auth'
import { ApiError } from '../src/errors/api_error'
import { JwtService, AccessTokenClaims } from '../src/services/jwt_service'
import { randomUUID } from 'crypto'

describe('Phase 4.0.5 Auth Middleware', () => {
  const mockJwtService: JwtService = {
    signAccessToken: vi.fn(),
    verifyAccessToken: vi.fn()
  }

  const middleware = createJwtAuthMiddleware(mockJwtService)

  const createMockRequest = (headers: Record<string, string>, body?: any) => {
    return {
      headers,
      body
    } as AuthenticatedJwtRequest
  }

  const createMockResponse = () => {
    return {} as Response
  }

  it('AUTH-MW001 missing Authorization -> 401', () => {
    const req = createMockRequest({})
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('UNAUTHORIZED')
  })

  it('AUTH-MW002 malformed Authorization -> 401', () => {
    const req = createMockRequest({ authorization: 'Basic dXNlcjpwYXNz' })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('INVALID_TOKEN')
  })

  it('AUTH-MW003 invalid JWT -> 401', () => {
    const req = createMockRequest({ authorization: 'Bearer invalid.token' })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockImplementationOnce(() => {
      throw new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    })

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('INVALID_TOKEN')
  })

  it('AUTH-MW004 expired JWT -> 401', () => {
    const req = createMockRequest({ authorization: 'Bearer expired.token' })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockImplementationOnce(() => {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired')
    })

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('TOKEN_EXPIRED')
  })

  it('AUTH-MW005 wrong issuer -> 401', () => {
    const req = createMockRequest({ authorization: 'Bearer wrong-issuer' })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockImplementationOnce(() => {
      throw new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    })

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('INVALID_TOKEN')
  })

  it('AUTH-MW006 wrong audience -> 401', () => {
    const req = createMockRequest({ authorization: 'Bearer wrong-audience' })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockImplementationOnce(() => {
      throw new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or malformed')
    })

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('INVALID_TOKEN')
  })

  const validClaims: AccessTokenClaims = {
    sub: randomUUID(),
    business_id: randomUUID(),
    role: 'OWNER',
    session_id: randomUUID(),
    jti: randomUUID()
  }

  it('AUTH-MW007 valid JWT -> request proceeds', () => {
    const req = createMockRequest({ authorization: 'Bearer valid.token' })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    expect(error).toBeUndefined()
  })

  it('AUTH-MW008 req.user populated correctly', () => {
    const req = createMockRequest({ authorization: 'Bearer valid.token' })
    const res = createMockResponse()
    const next: NextFunction = () => {}

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    expect(req.user).toBeDefined()
    expect(req.user?.userId).toBe(validClaims.sub)
    expect(req.user?.businessId).toBe(validClaims.business_id)
    expect(req.user?.sessionId).toBe(validClaims.session_id)
    expect(req.user?.jti).toBe(validClaims.jti)
  })

  it('AUTH-MW009 req.businessId derived from JWT', () => {
    const req = createMockRequest({ authorization: 'Bearer valid.token' })
    const res = createMockResponse()
    const next: NextFunction = () => {}

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    expect(req.businessId).toBe(validClaims.business_id)
  })

  it('AUTH-MW010 body business_id matching JWT -> allowed', () => {
    const req = createMockRequest({ authorization: 'Bearer valid.token' }, { business_id: validClaims.business_id })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    expect(error).toBeUndefined()
  })

  it('AUTH-MW011 body business_id different -> 403', () => {
    const req = createMockRequest({ authorization: 'Bearer valid.token' }, { business_id: randomUUID() })
    const res = createMockResponse()
    let error: any
    const next: NextFunction = (err) => { error = err }

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.code).toBe('BUSINESS_ACCESS_DENIED')
  })

  it('AUTH-MW012 X-Demo header cannot override JWT identity', () => {
    const otherBusinessId = randomUUID()
    const req = createMockRequest({ 
      authorization: 'Bearer valid.token',
      'x-demo-business-id': otherBusinessId
    })
    const res = createMockResponse()
    const next: NextFunction = () => {}

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    // X-Demo header is ignored by this middleware, identity is strictly from JWT
    expect(req.businessId).toBe(validClaims.business_id)
    expect(req.businessId).not.toBe(otherBusinessId)
  })

  it('AUTH-MW013 role exposed correctly', () => {
    const req = createMockRequest({ authorization: 'Bearer valid.token' })
    const res = createMockResponse()
    const next: NextFunction = () => {}

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    middleware(req, res, next)

    expect(req.user?.role).toBe(validClaims.role)
  })

  it('AUTH-MW014 raw JWT never logged', () => {
    let logged = false
    const originalLog = console.log
    console.log = () => { logged = true }

    const req = createMockRequest({ authorization: 'Bearer test.token.here' })
    const res = createMockResponse()
    const next: NextFunction = () => {}

    vi.mocked(mockJwtService.verifyAccessToken).mockReturnValueOnce(validClaims)

    try {
      middleware(req, res, next)
      
      // Also test error path
      vi.mocked(mockJwtService.verifyAccessToken).mockImplementationOnce(() => {
        throw new Error('Boom')
      })
      middleware(req, res, next)
    } finally {
      console.log = originalLog
    }

    expect(logged).toBe(false)
  })
})
