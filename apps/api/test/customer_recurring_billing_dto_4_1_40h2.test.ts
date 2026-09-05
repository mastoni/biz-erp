import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { ValidationError } from '../src/errors/validation_error'
import {
  validateCreateCustomerSubscription,
  validateUpdateCustomerSubscription,
  validateSubscriptionAction,
  validateGenerateInvoice,
  validateSubscriptionQuery,
  isFinancialSubscriptionUpdate,
  VALID_CUSTOMER_BILLING_CYCLES,
  VALID_CUSTOMER_SUBSCRIPTION_STATUSES
} from '../src/dto/customer_subscription_dto'
import {
  validateRecordInvoicePayment,
  validateCancelInvoice,
  validateInvoiceQuery,
  VALID_INVOICE_STATUSES,
  VALID_PAYMENT_METHODS
} from '../src/dto/customer_invoice_dto'

describe('Phase 4.1.40H-2: Customer Recurring Billing DTO & Validation Contracts', () => {
  const sampleCustomerId = randomUUID()
  const sampleProductId = randomUUID()
  const sampleSubscriptionId = randomUUID()

  describe('1. Customer Subscription Creation Validation', () => {
    it('CRB-DTO-001: validates a valid subscription creation payload with all fields', () => {
      const payload = {
        customer_id: sampleCustomerId,
        plan_code: 'BROADBAND_100M',
        product_id: sampleProductId,
        name: 'Internet 100 Mbps Home',
        unit_price_minor: 50000000,
        discount_minor: 5000000,
        tax_minor: 4950000,
        total_minor: 49950000,
        currency: 'idr',
        billing_cycle: 'MONTHLY',
        starts_at: '2026-10-01T00:00:00.000Z',
        ends_at: '2027-10-01T00:00:00.000Z',
        next_billing_date: '2026-10-01',
        anchor_day: 1,
        notes: 'VIP customer agreement',
        metadata: { bandwidth_mbps: 100, vlan: 20 }
      }

      const dto = validateCreateCustomerSubscription(payload)
      expect(dto.customer_id).toBe(sampleCustomerId)
      expect(dto.plan_code).toBe('BROADBAND_100M')
      expect(dto.product_id).toBe(sampleProductId)
      expect(dto.name).toBe('Internet 100 Mbps Home')
      expect(dto.unit_price_minor).toBe(50000000)
      expect(dto.discount_minor).toBe(5000000)
      expect(dto.tax_minor).toBe(4950000)
      expect(dto.total_minor).toBe(49950000)
      expect(dto.currency).toBe('IDR')
      expect(dto.billing_cycle).toBe('MONTHLY')
      expect(dto.anchor_day).toBe(1)
      expect(dto.notes).toBe('VIP customer agreement')
      expect(dto.metadata).toEqual({ bandwidth_mbps: 100, vlan: 20 })
    })

    it('CRB-DTO-002: auto-computes total_minor and defaults currency and discount/tax if omitted', () => {
      const payload = {
        customer_id: sampleCustomerId,
        name: 'Basic Service',
        unit_price_minor: 30000000,
        billing_cycle: 'QUARTERLY'
      }

      const dto = validateCreateCustomerSubscription(payload)
      expect(dto.discount_minor).toBe(0)
      expect(dto.tax_minor).toBe(0)
      expect(dto.total_minor).toBe(30000000)
      expect(dto.currency).toBe('IDR')
      expect(dto.billing_cycle).toBe('QUARTERLY')
    })

    it('CRB-DTO-003: rejects invalid or missing customer_id (malformed UUID)', () => {
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: 'not-a-uuid',
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY'
        })
      ).toThrow(ValidationError)

      expect(() =>
        validateCreateCustomerSubscription({
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY'
        })
      ).toThrow(ValidationError)
    })

    it('CRB-DTO-004: rejects invalid billing_cycle', () => {
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'DAILY'
        })
      ).toThrow(ValidationError)

      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: ''
        })
      ).toThrow(ValidationError)
    })

    it('CRB-DTO-005: rejects invalid monetary amounts (negative, float, discount > unit price, mismatched total)', () => {
      // Negative unit_price_minor
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: -1000,
          billing_cycle: 'MONTHLY'
        })
      ).toThrow(ValidationError)

      // Float amount
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 1000.5,
          billing_cycle: 'MONTHLY'
        })
      ).toThrow(ValidationError)

      // Discount > unit price
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 10000,
          discount_minor: 15000,
          billing_cycle: 'MONTHLY'
        })
      ).toThrow(ValidationError)

      // Provided total_minor does not match unit - discount + tax
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          discount_minor: 10000,
          tax_minor: 10000,
          total_minor: 999999, // mismatch (should be 100000)
          billing_cycle: 'MONTHLY'
        })
      ).toThrow(ValidationError)
    })

    it('CRB-DTO-006: rejects invalid anchor_day values (0, 32, floats)', () => {
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY',
          anchor_day: 0
        })
      ).toThrow(ValidationError)

      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY',
          anchor_day: 32
        })
      ).toThrow(ValidationError)

      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY',
          anchor_day: 15.5
        })
      ).toThrow(ValidationError)
    })

    it('CRB-DTO-007: validates date constraints (ends_at <= starts_at, invalid format)', () => {
      // Invalid format
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY',
          starts_at: 'not-a-date'
        })
      ).toThrow(ValidationError)

      // ends_at before starts_at
      expect(() =>
        validateCreateCustomerSubscription({
          customer_id: sampleCustomerId,
          name: 'Plan',
          unit_price_minor: 100000,
          billing_cycle: 'MONTHLY',
          starts_at: '2026-10-01T00:00:00.000Z',
          ends_at: '2026-09-01T00:00:00.000Z'
        })
      ).toThrow(ValidationError)
    })

    it('CRB-DTO-008: rejects non-object payloads', () => {
      expect(() => validateCreateCustomerSubscription(null)).toThrow(ValidationError)
      expect(() => validateCreateCustomerSubscription('string')).toThrow(ValidationError)
      expect(() => validateCreateCustomerSubscription([])).toThrow(ValidationError)
    })
  })

  describe('2. Customer Subscription Update & RBAC Financial Distinction', () => {
    it('CRB-DTO-009: validates operational update payload and identifies it as non-financial', () => {
      const payload = {
        name: 'Updated Subscription Name',
        notes: 'Changed customer contract contact',
        metadata: { speed: '200Mbps' },
        ends_at: '2028-12-31T23:59:59.000Z'
      }

      const dto = validateUpdateCustomerSubscription(payload)
      expect(dto.name).toBe('Updated Subscription Name')
      expect(dto.notes).toBe('Changed customer contract contact')
      expect(dto.metadata).toEqual({ speed: '200Mbps' })
      expect(isFinancialSubscriptionUpdate(dto)).toBe(false)
    })

    it('CRB-DTO-010: validates financial pricing snapshot update and identifies it as financial for RBAC', () => {
      const payload = {
        unit_price_minor: 65000000,
        discount_minor: 5000000,
        tax_minor: 6000000,
        total_minor: 66000000,
        billing_cycle: 'SEMI_ANNUAL'
      }

      const dto = validateUpdateCustomerSubscription(payload)
      expect(dto.unit_price_minor).toBe(65000000)
      expect(dto.billing_cycle).toBe('SEMI_ANNUAL')
      expect(isFinancialSubscriptionUpdate(dto)).toBe(true)
    })

    it('CRB-DTO-011: rejects empty update payload', () => {
      expect(() => validateUpdateCustomerSubscription({})).toThrow(ValidationError)
      expect(() => validateUpdateCustomerSubscription(null)).toThrow(ValidationError)
    })
  })

  describe('3. Action & Generation Requests', () => {
    it('CRB-DTO-012: validates subscription action request (pause/resume/cancel reason)', () => {
      expect(validateSubscriptionAction({ reason: 'Customer requested pause' })).toEqual({
        reason: 'Customer requested pause'
      })
      expect(validateSubscriptionAction({})).toEqual({ reason: undefined })
      expect(() => validateSubscriptionAction({ reason: 12345 })).toThrow(ValidationError)
    })

    it('CRB-DTO-013: validates manual generate invoice request', () => {
      const valid = validateGenerateInvoice({
        billing_period_start: '2026-10-01',
        billing_period_end: '2026-10-31',
        due_date: '2026-10-10',
        notes: 'Manual bill run'
      })
      expect(valid.billing_period_start).toBe('2026-10-01')
      expect(valid.billing_period_end).toBe('2026-10-31')

      // Invalid period (end before start)
      expect(() =>
        validateGenerateInvoice({
          billing_period_start: '2026-10-31',
          billing_period_end: '2026-10-01'
        })
      ).toThrow(ValidationError)

      // Invalid date format
      expect(() =>
        validateGenerateInvoice({
          billing_period_start: '10/01/2026'
        })
      ).toThrow(ValidationError)
    })
  })

  describe('4. Invoice Payment Recording & Cancellation DTO Validation', () => {
    it('CRB-DTO-014: validates valid invoice payment recording payload', () => {
      const payload = {
        amount_minor: 55000000,
        method: 'BANK_TRANSFER',
        reference: 'TRX-BCA-998811',
        idempotency_key: 'idemp-pay-001'
      }

      const dto = validateRecordInvoicePayment(payload)
      expect(dto.amount_minor).toBe(55000000)
      expect(dto.method).toBe('bank_transfer')
      expect(dto.reference).toBe('TRX-BCA-998811')
      expect(dto.idempotency_key).toBe('idemp-pay-001')
    })

    it('CRB-DTO-015: rejects invalid payment payload (non-positive amount, invalid method, empty idempotency key)', () => {
      // Non-positive amount
      expect(() =>
        validateRecordInvoicePayment({
          amount_minor: 0,
          method: 'cash',
          idempotency_key: 'key-1'
        })
      ).toThrow(ValidationError)

      expect(() =>
        validateRecordInvoicePayment({
          amount_minor: -5000,
          method: 'cash',
          idempotency_key: 'key-1'
        })
      ).toThrow(ValidationError)

      // Invalid method
      expect(() =>
        validateRecordInvoicePayment({
          amount_minor: 10000,
          method: 'CRYPTO_BITCOIN',
          idempotency_key: 'key-1'
        })
      ).toThrow(ValidationError)

      // Missing or empty idempotency key
      expect(() =>
        validateRecordInvoicePayment({
          amount_minor: 10000,
          method: 'cash',
          idempotency_key: '   '
        })
      ).toThrow(ValidationError)
    })

    it('CRB-DTO-016: validates invoice cancellation payload', () => {
      expect(validateCancelInvoice({ reason: 'Incorrect billing cycle' })).toEqual({
        reason: 'Incorrect billing cycle'
      })
      expect(validateCancelInvoice({})).toEqual({ reason: undefined })
      expect(() => validateCancelInvoice({ reason: 999 })).toThrow(ValidationError)
    })
  })

  describe('5. Query & Filter Parameters Validation', () => {
    it('CRB-DTO-017: validates valid subscription and invoice query filters', () => {
      const subQ = validateSubscriptionQuery({
        customer_id: sampleCustomerId,
        status: 'active',
        billing_cycle: 'monthly',
        search: 'Paket',
        limit: '25',
        offset: '50'
      })
      expect(subQ.customer_id).toBe(sampleCustomerId)
      expect(subQ.status).toBe('ACTIVE')
      expect(subQ.billing_cycle).toBe('MONTHLY')
      expect(subQ.search).toBe('Paket')
      expect(subQ.limit).toBe(25)
      expect(subQ.offset).toBe(50)

      const invQ = validateInvoiceQuery({
        customer_id: sampleCustomerId,
        customer_subscription_id: sampleSubscriptionId,
        status: 'issued',
        date_from: '2026-09-01',
        date_to: '2026-09-30',
        limit: '10',
        offset: '0'
      })
      expect(invQ.customer_id).toBe(sampleCustomerId)
      expect(invQ.customer_subscription_id).toBe(sampleSubscriptionId)
      expect(invQ.status).toBe('ISSUED')
      expect(invQ.date_from).toBe('2026-09-01')
      expect(invQ.date_to).toBe('2026-09-30')
      expect(invQ.limit).toBe(10)
    })

    it('CRB-DTO-018: rejects invalid query params (malformed UUID, invalid date range, negative limit)', () => {
      expect(() => validateSubscriptionQuery({ customer_id: 'bad-uuid' })).toThrow(
        ValidationError
      )
      expect(() => validateSubscriptionQuery({ status: 'INVALID_STATUS' })).toThrow(
        ValidationError
      )
      expect(() => validateSubscriptionQuery({ limit: '-5' })).toThrow(ValidationError)

      expect(() =>
        validateInvoiceQuery({
          date_from: '2026-10-31',
          date_to: '2026-10-01'
        })
      ).toThrow(ValidationError)
    })
  })
})
