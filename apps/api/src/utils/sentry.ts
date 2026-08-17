import * as Sentry from '@sentry/node'
import { Env } from '../config/env'

let initialized = false

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'authorization',
  'access_token',
  'refresh_token',
  'cookie',
  'jwt_secret',
  'database_url',
  'postgres_password'
])

function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase())
}

function scrubString(val: string): string {
  if (val.includes('Bearer ') || val.includes('postgres://')) {
    return '[REDACTED]'
  }
  return val
}

function scrubObject(obj: any, depth = 0): any {
  if (depth > 5) return obj
  if (obj == null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return scrubString(obj)
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(item => scrubObject(item, depth + 1))
  }
  const scrubbed: any = {}
  for (const [key, val] of Object.entries(obj)) {
    if (isSensitive(key)) {
      scrubbed[key] = '[REDACTED]'
    } else {
      scrubbed[key] = scrubObject(val, depth + 1)
    }
  }
  return scrubbed
}

export function initSentry(env: Env): void {
  if (initialized) return
  if (!env.sentryDsn) return

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    release: env.sentryRelease,
    tracesSampleRate: env.sentryTracesSampleRate,
    profilesSampleRate: env.sentryProfilesSampleRate,
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = scrubObject(event.request.headers)
        }
        if (event.request.data) {
          event.request.data = scrubObject(event.request.data)
        }
      }
      if (event.extra) {
        event.extra = scrubObject(event.extra)
      }
      if (event.contexts) {
        event.contexts = scrubObject(event.contexts)
      }
      if (event.tags) {
        event.tags = scrubObject(event.tags)
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            breadcrumb.data = scrubObject(breadcrumb.data)
          }
          if (breadcrumb.message) {
            breadcrumb.message = scrubString(breadcrumb.message)
          }
          return breadcrumb
        })
      }
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map(ex => {
          if (ex.value) {
            ex.value = scrubString(ex.value)
          }
          return ex
        })
      }
      return event
    },
    beforeSendTransaction(event) {
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = scrubObject(event.request.headers)
        }
        if (event.request.data) {
          event.request.data = scrubObject(event.request.data)
        }
      }
      if (event.extra) {
        event.extra = scrubObject(event.extra)
      }
      if (event.contexts) {
        event.contexts = scrubObject(event.contexts)
      }
      if (event.tags) {
        event.tags = scrubObject(event.tags)
      }
      return event
    }
  })

  initialized = true
}

export async function flushSentry(timeoutMs: number = 2000): Promise<boolean> {
  if (!initialized) return true
  try {
    return await Sentry.close(timeoutMs)
  } catch {
    return false
  }
}

export function captureException(err: unknown, requestId?: string): void {
  if (!initialized) return
  Sentry.captureException(err, {
    tags: {
      request_id: requestId
    }
  })
}
