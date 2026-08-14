import { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'crypto'

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-request-id']
  const id = Array.isArray(headerValue) ? headerValue[0] : headerValue || randomUUID()

  res.setHeader('X-Request-Id', id)
  res.locals.requestId = id
  next()
}
