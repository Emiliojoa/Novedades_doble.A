BEGIN;
SET LOCAL search_path TO store, public;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK(payment_method IN ('EFECTIVO','TRANSFERENCIA'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK(payment_status IN ('PENDING_PAYMENT','PENDING_VERIFICATION','APPROVED','REJECTED'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percentage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_alias_snapshot TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_approved_by BIGINT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_fingerprint TEXT;
UPDATE orders SET subtotal=total WHERE subtotal IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_idempotency ON orders(user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_order_payment ON orders(payment_method,payment_status,id);
CREATE TABLE IF NOT EXISTS payment_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), bank_alias TEXT NOT NULL,
 cash_discount_percentage INTEGER NOT NULL CHECK(cash_discount_percentage BETWEEN 0 AND 100),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO payment_settings(id,bank_alias,cash_discount_percentage) VALUES(1,'emilio.joa.mp',3) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS payment_receipts (
 id TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), order_id BIGINT REFERENCES orders(id),
 storage_path TEXT NOT NULL, original_filename TEXT NOT NULL, mime_type TEXT NOT NULL,
 file_size INTEGER NOT NULL, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 verification_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK(verification_status IN ('PENDING_VERIFICATION','APPROVED','REJECTED')),
 rejection_reason TEXT, reviewed_at TIMESTAMPTZ, reviewed_by BIGINT REFERENCES users(id),
 local_content TEXT
);
CREATE INDEX IF NOT EXISTS idx_receipts_order ON payment_receipts(order_id);
CREATE TABLE IF NOT EXISTS payment_audit (
 id TEXT PRIMARY KEY, order_id BIGINT REFERENCES orders(id), actor_id BIGINT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, details TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_settings,payment_receipts,payment_audit FROM PUBLIC,anon,authenticated;
COMMIT;
