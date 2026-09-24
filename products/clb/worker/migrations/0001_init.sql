-- D1 schema for the practice-coach Worker. Privacy rules (memo §4.1): audio is never stored;
-- essays/transcripts live only here and are purged RETENTION_DAYS after the user's last activity;
-- IPs and device ids are stored only as salted SHA-256 hashes.

CREATE TABLE users (
  id TEXT PRIMARY KEY,                -- random id
  email TEXT NOT NULL UNIQUE,         -- lower-cased; replaced by 'deleted:<id>' on account deletion
  email_hash TEXT NOT NULL,           -- saltedHash('email:'+email); kept after deletion so the once-per-email refund rule survives re-signup
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  adult_confirmed_at TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  marketing_consent_text TEXT,        -- exact wording shown (CASL s.13 evidence)
  marketing_consent_version TEXT,     -- MARKETING_CONSENT.version the wording came from
  marketing_consent_at TEXT,
  marketing_withdrawn_at TEXT,
  free_speaking_used INTEGER NOT NULL DEFAULT 0,
  self_refund_used INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE INDEX users_email_hash ON users(email_hash);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,           -- SHA-256 of the cookie value
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,        -- SHA-256 of the emailed token
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  pending_json TEXT                   -- consent/adult/lang captured at request time
);
CREATE INDEX magic_links_email ON magic_links(email, created_at);

CREATE TABLE passes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  sku TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT
);
CREATE INDEX passes_user ON passes(user_id, ends_at);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,                -- Stripe Checkout Session id
  user_id TEXT NOT NULL REFERENCES users(id),
  sku TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_intent TEXT,
  charge_id TEXT,
  card_fingerprint TEXT,
  card_country TEXT,
  billing_country TEXT,
  billing_region TEXT,
  status TEXT NOT NULL,               -- pending | paid | refunded | disputed | rejected_region
  created_at TEXT NOT NULL,
  paid_at TEXT,
  refunded_at TEXT
);
CREATE INDEX purchases_user ON purchases(user_id);
CREATE INDEX purchases_fingerprint ON purchases(card_fingerprint);
CREATE INDEX purchases_charge ON purchases(charge_id);
CREATE INDEX purchases_payment_intent ON purchases(payment_intent);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,                -- Stripe event id (idempotency)
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  user_id TEXT,                       -- null for the anonymous free sample
  device_hash TEXT,
  task_id TEXT NOT NULL,
  prompt_index INTEGER NOT NULL,
  kind TEXT NOT NULL,                 -- writing | speaking
  input_text TEXT,                    -- essay or transcript (purged after retention)
  result_json TEXT,                   -- GradeResult (purged after retention)
  error_kinds TEXT,                   -- comma-separated error categories (kept for the recurring-error log)
  free INTEGER NOT NULL DEFAULT 0,
  refused INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  audio_seconds REAL NOT NULL DEFAULT 0,
  cost_micro_usd INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX grades_user ON grades(user_id, created_at);
CREATE INDEX grades_created ON grades(created_at);

CREATE TABLE free_usage (
  key_hash TEXT NOT NULL,             -- device or ip/24 hash
  kind TEXT NOT NULL,                 -- device | ip
  day TEXT NOT NULL,                  -- YYYY-MM-DD (UTC)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, kind, day)
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  user_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,               -- self_serve | region | owner (disputes set purchases.status only)
  created_at TEXT NOT NULL
);
CREATE INDEX refunds_purchase ON refunds(purchase_id);
CREATE INDEX refunds_reason_user ON refunds(reason, user_id);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT,
  utm_json TEXT,                      -- utm_* and gclid only
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX events_day ON events(day, name);

CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  message TEXT NOT NULL,
  lang TEXT NOT NULL,
  created_at TEXT NOT NULL,
  forwarded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE metrics_daily (
  day TEXT PRIMARY KEY,               -- aggregate only, no personal data
  json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
