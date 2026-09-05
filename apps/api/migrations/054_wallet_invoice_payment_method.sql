-- Phase DW-2B: Digital Wallet Invoice Payment Method
-- Extends customer_payments.method check constraint to allow 'wallet' while preserving all existing methods.
-- Extends wallet_ledgers.transaction_type check constraint to permit 'INVOICE_PAYMENT'.

DO $$
BEGIN
    ALTER TABLE customer_payments DROP CONSTRAINT IF EXISTS customer_payments_method_check;
    ALTER TABLE customer_payments ADD CONSTRAINT customer_payments_method_check
        CHECK (method IN ('cash', 'bank_transfer', 'debit', 'credit', 'wallet'));

    ALTER TABLE wallet_ledgers DROP CONSTRAINT IF EXISTS wallet_ledgers_transaction_type_check;
    ALTER TABLE wallet_ledgers ADD CONSTRAINT wallet_ledgers_transaction_type_check
        CHECK (transaction_type IN (
            'TOP_UP', 'DEBIT', 'CREDIT', 'TRANSFER', 'REFUND', 'REVERSAL', 'FEE', 'ADJUSTMENT', 'INVOICE_PAYMENT'
        ));
END $$;

INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility, description)
VALUES (
    'DIGITAL_WALLET',
    'SKMNetwork Digital Wallet',
    'FINANCIAL',
    'INTERNAL',
    'PLATFORM',
    'ACTIVE',
    TRUE,
    'Digital Stored-Value Wallet and Account Ledger Service'
)
ON CONFLICT (code) DO UPDATE SET
    lifecycle_status = 'ACTIVE';


