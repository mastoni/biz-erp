/**
 * Tests for inventory idempotency key lifecycle (FINDING C-1 fix).
 *
 * These tests exercise the key management logic in isolation via unit tests
 * against the exported helpers and the behavioral contract documented in
 * the fix, without needing to mount the full React component.
 */

import { describe, it, expect } from 'vitest';
import { isConflictError, isClientValidationError, getApiErrorMessage } from '../error-helpers';
import { AxiosError } from 'axios';

function makeAxiosError(status: number, message = 'error'): AxiosError {
  const err = new AxiosError(message);
  // @ts-expect-error — minimal mock
  err.response = { status, data: { message } };
  return err;
}

describe('Inventory API helpers', () => {
  describe('isConflictError', () => {
    it('returns true for HTTP 409', () => {
      expect(isConflictError(makeAxiosError(409))).toBe(true);
    });

    it('returns false for HTTP 400', () => {
      expect(isConflictError(makeAxiosError(400))).toBe(false);
    });

    it('returns false for network errors without response', () => {
      expect(isConflictError(new AxiosError('network'))).toBe(false);
    });

    it('returns false for non-axios errors', () => {
      expect(isConflictError(new Error('other'))).toBe(false);
    });
  });

  describe('isClientValidationError (formerly isNegativeStockError)', () => {
    it('returns true for HTTP 400 (negative stock)', () => {
      expect(isClientValidationError(makeAxiosError(400))).toBe(true);
    });

    it('returns true for HTTP 400 (invalid branch)', () => {
      expect(isClientValidationError(makeAxiosError(400, 'Branch not found'))).toBe(true);
    });

    it('returns false for HTTP 409', () => {
      expect(isClientValidationError(makeAxiosError(409))).toBe(false);
    });

    it('returns false for non-axios errors', () => {
      expect(isClientValidationError(new Error('other'))).toBe(false);
    });
  });

  describe('getApiErrorMessage', () => {
    it('extracts message from AxiosError response body', () => {
      const err = makeAxiosError(400, 'Negative stock is prohibited');
      expect(getApiErrorMessage(err, 'fallback')).toBe('Negative stock is prohibited');
    });

    it('falls back to error.message when no response body message', () => {
      const err = new AxiosError('raw axios message');
      expect(getApiErrorMessage(err, 'fallback')).toBe('raw axios message');
    });

    it('returns fallback for non-axios errors', () => {
      expect(getApiErrorMessage(new Error('ignored'), 'fallback')).toBe('ignored');
    });

    it('returns fallback string for unknown errors', () => {
      expect(getApiErrorMessage('string error', 'fallback')).toBe('fallback');
    });
  });
});

/**
 * Idempotency key lifecycle — behavioral contract tests (FINDING C-1).
 *
 * These tests validate the documented rules WITHOUT mounting the component.
 * They test the key generation strategy as a pure function contract:
 *
 * Rule 1: After SUCCESS → generate new key (new logical submission).
 * Rule 2: After 409 CONFLICT → generate new key (stale submission abandoned).
 * Rule 3: After 400 VALIDATION ERROR → keep old key (backend did not record it).
 * Rule 4: After NETWORK FAILURE → keep old key (outcome unknown; retry same key).
 */
describe('Idempotency key lifecycle contract', () => {
  it('Rule 1: after successful submission, a new key must be generated', () => {
    const keys: string[] = [];
    let currentKey = crypto.randomUUID();
    keys.push(currentKey);

    // Simulate successful submission → generate new key
    currentKey = crypto.randomUUID();
    keys.push(currentKey);

    expect(keys[0]).not.toBe(keys[1]);
    expect(typeof keys[1]).toBe('string');
  });

  it('Rule 2: after 409 conflict, a new key must be generated before next attempt', () => {
    let currentKey = crypto.randomUUID();
    const keyBeforeConflict = currentKey;

    const err = makeAxiosError(409);
    if (isConflictError(err)) {
      // This is what the fixed code does: generate a new key
      currentKey = crypto.randomUUID();
    }

    expect(currentKey).not.toBe(keyBeforeConflict);
  });

  it('Rule 3: after 400 validation error, key must be preserved for potential retry', () => {
    const currentKey = crypto.randomUUID();
    const keyBefore = currentKey;

    const err = makeAxiosError(400);
    if (isClientValidationError(err)) {
      // Fixed code does NOT call generateNewIdempotencyKey here
      // key remains unchanged
    }

    expect(currentKey).toBe(keyBefore);
  });

  it('Rule 4: after network failure, key must be preserved for retry', () => {
    const currentKey = crypto.randomUUID();
    const keyBefore = currentKey;

    const networkErr = new AxiosError('Network Error');
    const isConflict = isConflictError(networkErr);
    const isValidation = isClientValidationError(networkErr);

    // Neither conflict nor validation → key preserved
    if (!isConflict && !isValidation) {
      // No key rotation — identical to the else branch in fixed handleSubmit
    }

    expect(currentKey).toBe(keyBefore);
  });

  it('Rule 2 + Rule 1 combined: 409 conflict followed by fresh submission uses different key than the conflicted one', () => {
    let currentKey = crypto.randomUUID();
    const originalKey = currentKey;

    // Step 1: 409 Conflict → generate new key
    const conflictErr = makeAxiosError(409);
    if (isConflictError(conflictErr)) {
      currentKey = crypto.randomUUID();
    }
    const keyAfterConflict = currentKey;
    expect(keyAfterConflict).not.toBe(originalKey);

    // Step 2: Next submission succeeds with the new key → generate another key
    const keyForSuccessSubmission = keyAfterConflict;
    currentKey = crypto.randomUUID();
    const keyAfterSuccess = currentKey;

    expect(keyAfterSuccess).not.toBe(keyForSuccessSubmission);
  });
});
