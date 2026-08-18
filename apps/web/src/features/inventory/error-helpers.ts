import { AxiosError } from 'axios';

export function isConflictError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 409;
}

/**
 * Returns true for any HTTP 400 response from the inventory API.
 * This covers backend validation errors including (but not limited to):
 * negative stock prohibition, invalid branch, invalid product, etc.
 * Named generically because the backend returns 400 for multiple validation
 * reasons and the error code in the body should be read for further discrimination.
 */
export function isClientValidationError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 400;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
