import { describe, it, expect } from 'vitest'
import {
  validatePurchaseCreate,
  validatePurchaseUpdate,
  validatePurchaseSend,
  validatePurchaseReceive,
  validatePurchasePay,
  validatePurchaseCancel,
  calculateDueDate,
  generatePurchaseCode,
  computePurchaseCreateHash,
  computePurchaseSendHash,
  computePurchaseReceiveHash,
  computePurchasePayHash,
  computePurchaseCancelHash,
  VALID_PURCHASE_STATUSES,
  VALID_SUPPLIER_TERMS,
  VALID_PAYMENT_METHODS,
} from '../src/dto/purchase_dto'
import { ValidationError } from '../src/errors/validation_error'

describe('PHASE 9B — Purchase Contract Unit Tests', () => {
  const validUUID1 = '11111111-1111-4111-8111-111111111111'
  const validUUID2 = '22222222-2222-4222-8222-222222222222'
  const validUUID3 = '33333333-3333-4333-8333-333333333333'
  const validUUID4 = '44444444-4444-4444-8444-444444444444'
  const validUUID5 = '55555555-5555-4555-8555-555555555555'

  describe('Contract Enums & Constants', () => {
    it('LOCKED: Purchase statuses must be strictly (draft, sent, partial, received, cancelled)', () => {
      expect(VALID_PURCHASE_STATUSES).toEqual([
        'draft',
        'sent',
        'partial',
        'received',
        'cancelled',
      ])
    })

    it('LOCKED: Supplier terms must be strictly (Tunai, Tempo 14, Tempo 30)', () => {
      expect(VALID_SUPPLIER_TERMS).toEqual(['Tunai', 'Tempo 14', 'Tempo 30'])
    })

    it('LOCKED: Payment methods must be strictly (cash, bank_transfer, debit, credit)', () => {
      expect(VALID_PAYMENT_METHODS).toEqual([
        'cash',
        'bank_transfer',
        'debit',
        'credit',
      ])
    })
  })

  describe('Code Generation & Due Date Calculation', () => {
    it('PO-CODE-001: generates code with {supplierCode}/PO/{seq:03d} pattern', () => {
      expect(generatePurchaseCode('SUP-01', 1)).toBe('SUP-01/PO/001')
      expect(generatePurchaseCode('UMS', 42)).toBe('UMS/PO/042')
      expect(generatePurchaseCode('sup-sby', 123)).toBe('SUP-SBY/PO/123')
      expect(generatePurchaseCode('S1', 999)).toBe('S1/PO/999')
    })

    it('calculates due date according to supplier term', () => {
      expect(calculateDueDate('2026-08-01', 'Tunai')).toBe('2026-08-01')
      expect(calculateDueDate('2026-08-01', 'Tempo 14')).toBe('2026-08-15')
      expect(calculateDueDate('2026-08-01', 'Tempo 30')).toBe('2026-08-31')
    })
  })

  describe('validatePurchaseCreate', () => {
    it('validates a valid create request', () => {
      const valid = validatePurchaseCreate({
        id: validUUID1,
        business_id: validUUID2,
        branch_id: validUUID3,
        supplier_id: validUUID4,
        date: '2026-08-20',
        due_date: '2026-09-03',
        status: 'draft',
        note: 'Restock weekly',
        items: [
          { product_id: validUUID5, ordered_qty: 10 },
        ],
      })
      expect(valid.id).toBe(validUUID1)
      expect(valid.items).toHaveLength(1)
      expect(valid.items[0].ordered_qty).toBe(10)
    })

    it('rejects missing or non-UUID id', () => {
      expect(() =>
        validatePurchaseCreate({
          id: 'invalid-id',
          business_id: validUUID2,
          branch_id: validUUID3,
          supplier_id: validUUID4,
          items: [{ product_id: validUUID5, ordered_qty: 10 }],
        })
      ).toThrow(ValidationError)
    })

    it('rejects empty items array', () => {
      expect(() =>
        validatePurchaseCreate({
          id: validUUID1,
          business_id: validUUID2,
          branch_id: validUUID3,
          supplier_id: validUUID4,
          items: [],
        })
      ).toThrow(ValidationError)
    })

    it('rejects ordered_qty <= 0', () => {
      expect(() =>
        validatePurchaseCreate({
          id: validUUID1,
          business_id: validUUID2,
          branch_id: validUUID3,
          supplier_id: validUUID4,
          items: [{ product_id: validUUID5, ordered_qty: 0 }],
        })
      ).toThrow(ValidationError)

      expect(() =>
        validatePurchaseCreate({
          id: validUUID1,
          business_id: validUUID2,
          branch_id: validUUID3,
          supplier_id: validUUID4,
          items: [{ product_id: validUUID5, ordered_qty: -5 }],
        })
      ).toThrow(ValidationError)
    })

    it('rejects duplicate product_id in items', () => {
      expect(() =>
        validatePurchaseCreate({
          id: validUUID1,
          business_id: validUUID2,
          branch_id: validUUID3,
          supplier_id: validUUID4,
          items: [
            { product_id: validUUID5, ordered_qty: 5 },
            { product_id: validUUID5, ordered_qty: 10 },
          ],
        })
      ).toThrow(ValidationError)
    })
  })

  describe('validatePurchaseReceive', () => {
    it('validates a valid receive request', () => {
      const valid = validatePurchaseReceive({
        business_id: validUUID1,
        expected_server_version: 1,
        items: [{ item_id: validUUID2, receive_qty: 5 }],
      })
      expect(valid.expected_server_version).toBe(1)
      expect(valid.items[0].receive_qty).toBe(5)
    })

    it('rejects expected_server_version < 1', () => {
      expect(() =>
        validatePurchaseReceive({
          business_id: validUUID1,
          expected_server_version: 0,
          items: [{ item_id: validUUID2, receive_qty: 5 }],
        })
      ).toThrow(ValidationError)
    })

    it('rejects receive_qty <= 0', () => {
      expect(() =>
        validatePurchaseReceive({
          business_id: validUUID1,
          expected_server_version: 1,
          items: [{ item_id: validUUID2, receive_qty: 0 }],
        })
      ).toThrow(ValidationError)
    })

    it('rejects duplicate item_id in receive items', () => {
      expect(() =>
        validatePurchaseReceive({
          business_id: validUUID1,
          expected_server_version: 1,
          items: [
            { item_id: validUUID2, receive_qty: 2 },
            { item_id: validUUID2, receive_qty: 3 },
          ],
        })
      ).toThrow(ValidationError)
    })
  })

  describe('validatePurchasePay', () => {
    it('validates a valid pay request', () => {
      const valid = validatePurchasePay({
        business_id: validUUID1,
        expected_server_version: 2,
        amount_minor: 500000,
        method: 'cash',
        reference: 'REF-123',
      })
      expect(valid.amount_minor).toBe(500000)
      expect(valid.method).toBe('cash')
    })

    it('rejects amount_minor <= 0', () => {
      expect(() =>
        validatePurchasePay({
          business_id: validUUID1,
          expected_server_version: 1,
          amount_minor: 0,
          method: 'cash',
        })
      ).toThrow(ValidationError)
    })

    it('rejects invalid payment method', () => {
      expect(() =>
        validatePurchasePay({
          business_id: validUUID1,
          expected_server_version: 1,
          amount_minor: 10000,
          method: 'crypto',
        })
      ).toThrow(ValidationError)
    })
  })

  describe('Canonical Hashing', () => {
    it('computes deterministic create hash regardless of item ordering', () => {
      const req1 = {
        id: validUUID1,
        business_id: validUUID2,
        branch_id: validUUID3,
        supplier_id: validUUID4,
        items: [
          { product_id: validUUID1, ordered_qty: 1 },
          { product_id: validUUID5, ordered_qty: 2 },
        ],
      }
      const req2 = {
        id: validUUID1,
        business_id: validUUID2,
        branch_id: validUUID3,
        supplier_id: validUUID4,
        items: [
          { product_id: validUUID5, ordered_qty: 2 },
          { product_id: validUUID1, ordered_qty: 1 },
        ],
      }
      expect(computePurchaseCreateHash(req1)).toBe(computePurchaseCreateHash(req2))
    })

    it('computes distinct hashes for different versions or values', () => {
      const h1 = computePurchaseSendHash(validUUID1, { business_id: validUUID2, expected_server_version: 1 })
      const h2 = computePurchaseSendHash(validUUID1, { business_id: validUUID2, expected_server_version: 2 })
      expect(h1).not.toBe(h2)
    })
  })
})
