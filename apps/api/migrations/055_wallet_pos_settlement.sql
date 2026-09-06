-- Phase DW-2C: Digital Wallet POS Settlement Extension
-- Extends wallet_ledgers.transaction_type check constraint to permit 'POS_PAYMENT'.
-- Adds nullable wallet_id column to sales for authoritative audit lineage and relational indexing.

DO $$
BEGIN
    ALTER TABLE wallet_ledgers DROP CONSTRAINT IF EXISTS wallet_ledgers_transaction_type_check;
    ALTER TABLE wallet_ledgers ADD CONSTRAINT wallet_ledgers_transaction_type_check
        CHECK (transaction_type IN (
            'TOP_UP', 'DEBIT', 'CREDIT', 'TRANSFER', 'REFUND', 'REVERSAL', 'FEE', 'ADJUSTMENT', 'INVOICE_PAYMENT', 'POS_PAYMENT'
        ));

    ALTER TABLE sales
        ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_sales_wallet_id ON sales(wallet_id);
END $$;
