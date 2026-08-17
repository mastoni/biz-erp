import { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'crypto'

const UUIDV4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-request-id']
  const candidateId = Array.isArray(headerValue) ? headerValue[0] : headerValue

  let id: string = randomUUID()

  if (candidateId && typeof candidateId === 'string' && candidateId.length <= 36) {
    if (UUIDV4_REGEX.test(candidateId) && !/[\x00-\x1F\x7F]/.test(candidateId)) {
      id = candidateId
    }
  }

  res.setHeader('X-Request-Id', id)
  res.locals.requestId = id
  req.headers['x-request-id'] = id // For pino-http propagation if it reads req
  next()
}
