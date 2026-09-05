-- Phase SA-3.0B-1: Platform AI CS Settings & Control

CREATE TABLE IF NOT EXISTS platform_ai_cs_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    provider TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    model TEXT NOT NULL DEFAULT 'rule-engine-v1',
    fallback_behavior TEXT NOT NULL DEFAULT 'GENERAL_FAQ',
    human_escalation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent seed of default singleton row
INSERT INTO platform_ai_cs_settings (
    id, is_enabled, provider, model, fallback_behavior, human_escalation_enabled
) VALUES (
    'default', TRUE, 'DETERMINISTIC', 'rule-engine-v1', 'GENERAL_FAQ', TRUE
) ON CONFLICT (id) DO NOTHING;
