-- Migration 050: Fix subscription lifecycle validation trigger to allow non-status updates
--
-- Migration 016 introduced validate_subscription_transition() which did not allow
-- non-status column updates (such as account_customer_id, metadata, updated_at)
-- when OLD.status = NEW.status (e.g. ACTIVE -> ACTIVE).
-- This migration updates the trigger function to allow updates when status is unchanged.

CREATE OR REPLACE FUNCTION validate_subscription_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow initial insert (OLD is null)
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- Allow updates if status did not change
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Define valid transitions
    IF OLD.status = 'PENDING' THEN
        IF NEW.status NOT IN ('ACTIVE', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from PENDING to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'ACTIVE' THEN
        IF NEW.status NOT IN ('SUSPENDED', 'EXPIRED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from ACTIVE to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'SUSPENDED' THEN
        IF NEW.status NOT IN ('ACTIVE', 'EXPIRED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from SUSPENDED to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'EXPIRED' THEN
        IF NEW.status NOT IN ('CANCELLED') THEN
            RAISE EXCEPTION 'Invalid transition from EXPIRED to %', NEW.status;
        END IF;
    ELSIF OLD.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot transition from CANCELLED';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
