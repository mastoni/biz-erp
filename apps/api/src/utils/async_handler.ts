import { NextFunction, Request, RequestHandler, Response } from 'express'

export function asyncHandler<R extends Request = Request>(fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as R, res, next)).catch(next)
  }
}
