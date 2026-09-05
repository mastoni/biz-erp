-- Phase SA-3.0B-2: Support Ticket AI CS Source and Traceability Hardening

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'MANUAL'
CHECK (source IN ('MANUAL', 'AI_CS', 'SYSTEM', 'API'));

CREATE INDEX IF NOT EXISTS idx_support_tickets_source ON support_tickets(source);
CREATE INDEX IF NOT EXISTS idx_support_tickets_conversation_id ON support_tickets(conversation_id);

-- Backfill source for any existing tickets linked to AI conversations
UPDATE support_tickets
SET source = 'AI_CS'
WHERE conversation_id IS NOT NULL AND (source = 'MANUAL' OR source IS NULL);
