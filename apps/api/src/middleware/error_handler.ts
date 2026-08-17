import { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors/api_error'
import { logger } from '../utils/logger'

type PgLikeError = {
  code?: string
  message?: string
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    })
    return
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON body',
        details: {}
      }
    })
    return
  }

  const pgError = err as PgLikeError

  if (pgError && typeof pgError === 'object' && 'code' in pgError) {
    if (pgError.code === '23514') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Database constraint violation',
          details: {}
        }
      })
      return
    }

    if (pgError.code === '22P02') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid UUID value',
          details: {}
        }
      })
      return
    }

    if (pgError.code === '23505') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Duplicate resource',
          details: {}
        }
      })
      return
    }
  }

  logger.error({
    err,
    request_id: res.locals.requestId,
    route: req.path,
    status: 500,
    msg: 'Unhandled internal error'
  })

  res.status(500).json({
    error: {
      code: 'DATABASE_ERROR',
      message: 'Internal server error',
      details: {}
    }
  })
}
